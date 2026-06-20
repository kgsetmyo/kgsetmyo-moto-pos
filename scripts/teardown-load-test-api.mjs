/**
 * Teardown load-test sales via API void (no DIRECT_URL required).
 * Restores FIFO stock and reverses credit for sales tagged with LOAD_TEST_NOTE.
 * Usage: SMOKE_INSECURE_TLS=1 node --env-file=.env.local scripts/teardown-load-test-api.mjs
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
const LOAD_NOTE = process.env.LOAD_TEST_NOTE ?? "Load test automated transaction";
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
    body: JSON.stringify({ reason: "Load test teardown" }),
  });
  return { status: res.status, body: await res.text() };
}

async function main() {
  console.log(`\n🧹 Teardown load-test sales (note: "${LOAD_NOTE}")\n`);

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: sales, error } = await admin
    .from("sales")
    .select("id, invoice_number, status")
    .eq("notes", LOAD_NOTE)
    .eq("status", "COMPLETED");

  if (error) {
    console.error("❌ Query failed:", error.message);
    process.exit(1);
  }

  if (!sales?.length) {
    console.log("  ✅ No completed load-test sales to clean up\n");
    process.exit(0);
  }

  console.log(`  Found ${sales.length} sale(s) to void\n`);
  let cookie = await adminCookie();
  let voided = 0;
  let failed = 0;
  const batchSize = 5;

  for (let i = 0; i < sales.length; i += batchSize) {
    if (i > 0 && i % 15 === 0) cookie = await adminCookie();

    const batch = sales.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (sale) => {
        let result = await voidSale(sale.id, cookie);
        if (result.status === 401) {
          cookie = await adminCookie();
          result = await voidSale(sale.id, cookie);
        }
        return { sale, result };
      })
    );

    for (const { sale, result } of results) {
      if (result.status >= 200 && result.status < 300) {
        voided++;
        console.log(`  ✅ voided ${sale.invoice_number}`);
      } else {
        failed++;
        console.log(`  ❌ ${sale.invoice_number} — ${result.status} ${result.body.slice(0, 80)}`);
      }
    }
  }

  const { count } = await admin
    .from("sales")
    .select("id", { count: "exact", head: true })
    .eq("notes", LOAD_NOTE)
    .eq("status", "COMPLETED");

  console.log(`\n  Voided: ${voided}, failed: ${failed}, remaining completed: ${count ?? 0}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Teardown failed:", e.message);
  process.exit(1);
});
