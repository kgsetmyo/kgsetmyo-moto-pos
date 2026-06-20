/**
 * Check Supabase RPCs and optional migrations.
 * Usage: node --env-file=.env.local scripts/check-rpc.mjs
 */
import { createClient } from "@supabase/supabase-js";

if (process.env.SMOKE_INSECURE_TLS === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let failed = false;

async function checkRpc(name, args, required) {
  const { error } = await supabase.rpc(name, args);
  if (error?.message?.includes("Could not find the function")) {
    console.log(`❌ ${name} not installed.`);
    if (required) failed = true;
    return false;
  }
  console.log(`✅ ${name} installed`);
  return true;
}

async function checkTable(name, migrationFile) {
  const { error } = await supabase.from(name).select("id").limit(1);
  if (error?.message?.includes("does not exist") || error?.code === "42P01") {
    console.log(`⚠️  ${name} table missing — run ${migrationFile}`);
    return false;
  }
  if (error) {
    console.log(`⚠️  ${name}: ${error.message}`);
    return false;
  }
  console.log(`✅ ${name} table exists`);
  return true;
}

await checkRpc(
  "create_sale_with_fifo",
  {
    p_cashier_id: "00000000-0000-0000-0000-000000000001",
    p_lines: [],
    p_payments: [],
  },
  true
);

await checkRpc(
  "record_credit_payment",
  {
    p_customer_id: "00000000-0000-0000-0000-000000000001",
    p_amount: 1,
    p_method: "CASH",
    p_reference: null,
    p_notes: null,
    p_recorded_by: "00000000-0000-0000-0000-000000000001",
  },
  false
);

await checkRpc(
  "void_sale_with_fifo",
  {
    p_sale_id: "00000000-0000-0000-0000-000000000001",
    p_voided_by: "00000000-0000-0000-0000-000000000001",
    p_reason: "smoke check",
  },
  false
);

await checkTable("inventory_adjustments", "006_inventory_adjustments.sql");

const { error: creditErr } = await supabase
  .from("payments")
  .select("id")
  .eq("method", "CREDIT")
  .limit(1);
const creditMissing =
  creditErr?.message?.includes("invalid input value for enum") &&
  creditErr.message.includes("CREDIT");
if (creditMissing) {
  console.log("❌ payment_method missing CREDIT — run 008_payment_method_credit.sql");
  failed = true;
} else if (creditErr && !creditErr.message.includes("invalid input value")) {
  console.log(`⚠️  CREDIT enum check: ${creditErr.message}`);
} else {
  console.log("✅ payment_method includes CREDIT");
}

console.log("\nRequired migrations: 001 → 002 → 003 → 004");
console.log("Optional bundle: 008, 005, 006, 007 (optional_bundle.sql)\n");

if (failed) process.exit(1);
