/**
 * Snapshot total stock per product SKU (for load-test teardown verification).
 *
 * Usage:
 *   node --env-file=.env.local scripts/snapshot-stock.mjs
 *   node --env-file=.env.local scripts/snapshot-stock.mjs --json
 *   node --env-file=.env.local scripts/snapshot-stock.mjs --json --out scripts/.load-test/before.json
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import { createClient } from "@supabase/supabase-js";

if (process.env.SMOKE_INSECURE_TLS === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const asJson = process.argv.includes("--json");
const outIdx = process.argv.indexOf("--out");
const outPath = outIdx >= 0 ? process.argv[outIdx + 1] : null;

if (outPath && !asJson) {
  console.error("Use --json with --out to write a snapshot file");
  process.exit(1);
}
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { data: products, error: pErr } = await supabase
  .from("products")
  .select("id, sku, name")
  .eq("is_active", true)
  .order("sku");

if (pErr) {
  console.error("Failed to load products:", pErr.message);
  process.exit(1);
}

const snapshot = [];

for (const p of products ?? []) {
  const { data: batches } = await supabase
    .from("inventory_batches")
    .select("quantity_remaining")
    .eq("product_id", p.id);

  const total = (batches ?? []).reduce((s, b) => s + (b.quantity_remaining ?? 0), 0);
  snapshot.push({ sku: p.sku, productId: p.id, totalStock: total });
}

if (asJson) {
  const payload = JSON.stringify(snapshot, null, 2);
  if (outPath) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${payload}\n`, "utf8");
    console.error(`Wrote ${snapshot.length} product(s) → ${outPath}`);
  } else {
    console.log(payload);
  }
} else {
  console.log("\n📊 Stock snapshot\n");
  for (const row of snapshot) {
    console.log(`  ${row.sku.padEnd(20)} ${row.totalStock}`);
  }
  console.log(`\n  ${snapshot.length} active products\n`);
}
