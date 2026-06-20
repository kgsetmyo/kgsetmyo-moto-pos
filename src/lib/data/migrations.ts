import { createAdminClient } from "@/lib/supabase/admin";

export interface MigrationItem {
  id: string;
  label: string;
  migrationFile: string;
  installed: boolean;
  note?: string;
}

const DUMMY_UUID = "00000000-0000-0000-0000-000000000001";

export async function getMigrationStatus() {
  const supabase = createAdminClient();
  const items: MigrationItem[] = [];

  const { error: payRpcErr } = await supabase.rpc("record_credit_payment", {
    p_customer_id: DUMMY_UUID,
    p_amount: 1,
    p_method: "CASH",
    p_reference: null,
    p_notes: null,
    p_recorded_by: DUMMY_UUID,
  });
  const payRpcMissing = payRpcErr?.message?.includes("Could not find the function");
  items.push({
    id: "005",
    label: "Atomic credit payments",
    migrationFile: "005_record_credit_payment.sql",
    installed: !payRpcMissing,
    note: payRpcMissing ? "JS fallback active" : undefined,
  });

  const { error: voidRpcErr } = await supabase.rpc("void_sale_with_fifo", {
    p_sale_id: DUMMY_UUID,
    p_voided_by: DUMMY_UUID,
    p_reason: "check",
  });
  const voidRpcMissing = voidRpcErr?.message?.includes("Could not find the function");
  items.push({
    id: "007",
    label: "Void sale RPC",
    migrationFile: "007_void_sale_rpc.sql",
    installed: !voidRpcMissing,
    note: voidRpcMissing ? "JS fallback active" : undefined,
  });

  const { error: adjErr } = await supabase.from("inventory_adjustments").select("id").limit(1);
  const adjMissing =
    adjErr?.message?.includes("does not exist") ||
    adjErr?.message?.includes("schema cache") ||
    adjErr?.code === "42P01";
  items.push({
    id: "006",
    label: "Stock adjustment audit log",
    migrationFile: "006_inventory_adjustments.sql",
    installed: !adjMissing,
    note: adjMissing ? "Adjustments work; history not stored" : undefined,
  });

  const { error: creditErr } = await supabase
    .from("payments")
    .select("id")
    .eq("method", "CREDIT")
    .limit(1);
  const creditMissing =
    creditErr?.message?.includes("invalid input value for enum") &&
    creditErr.message.includes("CREDIT");
  items.push({
    id: "008",
    label: "CREDIT payment method",
    migrationFile: "008_payment_method_credit.sql",
    installed: !creditMissing,
    note: creditMissing ? "Credit sales blocked until applied" : undefined,
  });

  const pending = items.filter((i) => !i.installed);
  const allInstalled = pending.length === 0;

  return {
    allInstalled,
    pending,
    items,
    bundleFile: "supabase/migrations/optional_bundle.sql",
    applyHint: "Run npm run migrate:bundle, then paste optional_bundle.sql in Supabase SQL Editor",
  };
}
