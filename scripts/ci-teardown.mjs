/**
 * Best-effort cleanup of CI / smoke-test artifacts on staging Supabase.
 * Does not fail the workflow — logs warnings only.
 *
 * Usage: SMOKE_INSECURE_TLS=1 node --env-file=.env.local scripts/ci-teardown.mjs
 *
 * Env:
 *   CI_SMOKE_NOTE — sale note tag (default: "CI smoke test transaction")
 *   GITHUB_RUN_ID — optional run id appended by smoke tests
 */
import { createClient } from "@supabase/supabase-js";
import { stringToBase64URL } from "@supabase/ssr";
import { loadEnvFiles } from "./load-env.mjs";
import { getAdminCredentials } from "./test-credentials.mjs";

loadEnvFiles();

if (process.env.SMOKE_INSECURE_TLS === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const CI_SMOKE_NOTE = process.env.CI_SMOKE_NOTE ?? "CI smoke test transaction";
const GITHUB_RUN_ID = process.env.GITHUB_RUN_ID ?? "";
const { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } = getAdminCredentials();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sessionCookie(session) {
  const ref = new URL(url).hostname.split(".")[0];
  return `sb-${ref}-auth-token=${encodeURIComponent(`base64-${stringToBase64URL(JSON.stringify(session))}`)}`;
}

async function adminCookie() {
  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (error) throw new Error(error.message);
  return sessionCookie(data.session);
}

async function voidSale(saleId, cookie) {
  const res = await fetch(`${BASE}/api/sales/${saleId}/void`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "CI teardown" }),
  });
  return res.status;
}

async function deactivateCustomer(customerId, cookie) {
  const res = await fetch(`${BASE}/api/customers/${customerId}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
  return res.status;
}

async function main() {
  console.log(`\n🧹 CI teardown (note prefix: "${CI_SMOKE_NOTE}")\n`);

  if (!url || !serviceKey) {
    console.log("  ⚠️  Missing Supabase env — skipped\n");
    process.exit(0);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let cookie;
  try {
    cookie = await adminCookie();
  } catch (e) {
    console.log(`  ⚠️  Admin login failed — skipped (${e.message})\n`);
    process.exit(0);
  }

  const notePatterns = [CI_SMOKE_NOTE];
  if (GITHUB_RUN_ID) notePatterns.push(`run ${GITHUB_RUN_ID}`);

  const { data: sales, error: salesError } = await admin
    .from("sales")
    .select("id, invoice_number, notes, status")
    .eq("status", "COMPLETED")
    .eq("source", "IN_STORE");

  if (salesError) {
    console.log(`  ⚠️  Sales query failed: ${salesError.message}\n`);
    process.exit(0);
  }

  const salesToVoid = (sales ?? []).filter((sale) => {
    const notes = String(sale.notes ?? "");
    return notePatterns.some((pattern) => notes.includes(pattern));
  });

  let voided = 0;
  for (const sale of salesToVoid) {
    let status = await voidSale(sale.id, cookie);
    if (status === 401) {
      cookie = await adminCookie();
      status = await voidSale(sale.id, cookie);
    }
    if (status >= 200 && status < 300) {
      voided++;
      console.log(`  ✅ voided sale ${sale.invoice_number}`);
    } else {
      console.log(`  ⚠️  could not void ${sale.invoice_number} (${status})`);
    }
  }

  if (salesToVoid.length === 0) {
    console.log("  ✅ no tagged CI sales to void");
  }

  const { data: customers, error: customersError } = await admin
    .from("customers")
    .select("id, name, is_active")
    .eq("is_active", true)
    .or("name.ilike.Smoke Test %,name.ilike.Credit %");

  if (customersError) {
    console.log(`  ⚠️  Customer query failed: ${customersError.message}`);
  } else {
    let deactivated = 0;
    for (const customer of customers ?? []) {
      let status = await deactivateCustomer(customer.id, cookie);
      if (status === 401) {
        cookie = await adminCookie();
        status = await deactivateCustomer(customer.id, cookie);
      }
      if (status >= 200 && status < 300) {
        deactivated++;
        console.log(`  ✅ deactivated customer ${customer.name}`);
      } else {
        console.log(`  ⚠️  could not deactivate ${customer.name} (${status})`);
      }
    }
    if ((customers ?? []).length === 0) {
      console.log("  ✅ no stray smoke customers");
    } else {
      console.log(`  ℹ️  deactivated ${deactivated}/${customers.length} customer(s)`);
    }
  }

  const { data: brands, error: brandsError } = await admin
    .from("bike_brands")
    .select("id, name")
    .ilike("name", "SmokeBrand%");

  if (brandsError) {
    console.log(`  ⚠️  Bike brand query failed: ${brandsError.message}`);
  } else if (brands?.length) {
    const ids = brands.map((b) => b.id);
    const { error: deleteError } = await admin.from("bike_brands").delete().in("id", ids);
    if (deleteError) {
      console.log(`  ⚠️  Bike brand cleanup: ${deleteError.message}`);
    } else {
      console.log(`  ✅ removed ${brands.length} smoke bike brand(s)`);
    }
  }

  console.log(`\n  Done — voided ${voided} sale(s)\n`);
  process.exit(0);
}

main().catch((e) => {
  console.log(`  ⚠️  Teardown error (non-fatal): ${e.message}\n`);
  process.exit(0);
});
