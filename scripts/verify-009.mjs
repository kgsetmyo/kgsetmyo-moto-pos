/**
 * Verify migration 009: FIFO partial index + create_sale_with_fifo comment.
 * Usage: SMOKE_INSECURE_TLS=1 node --env-file=.env.local scripts/verify-009.mjs
 */
import { connectPostgres } from "./db-connect.mjs";
import { loadEnvLocal } from "./load-env.mjs";

loadEnvLocal();

if (process.env.SMOKE_INSECURE_TLS === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const { client } = await connectPostgres();
let failed = false;

try {
  const { rows: indexes } = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_inventory_batches_fifo_active'
  `);

  if (indexes.length === 0) {
    console.log("❌ idx_inventory_batches_fifo_active not found");
    failed = true;
  } else {
    console.log("✅ idx_inventory_batches_fifo_active exists");
    console.log(`   ${indexes[0].indexdef}`);
    if (!indexes[0].indexdef.includes("quantity_remaining > 0")) {
      console.log("❌ Partial index predicate missing quantity_remaining > 0");
      failed = true;
    }
  }

  const { rows: comments } = await client.query(`
    SELECT obj_description(p.oid, 'pg_proc') AS description
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_sale_with_fifo'
    LIMIT 1
  `);

  const desc = comments[0]?.description ?? "";
  if (!desc.includes("FOR UPDATE")) {
    console.log("❌ create_sale_with_fifo comment missing FOR UPDATE reference");
    console.log(`   description: ${desc || "(empty)"}`);
    failed = true;
  } else {
    console.log("✅ create_sale_with_fifo comment confirms FOR UPDATE lock");
    console.log(`   ${desc}`);
  }

  const { rows: src } = await client.query(`
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_sale_with_fifo'
    LIMIT 1
  `);

  if (!src[0]?.def?.includes("FOR UPDATE")) {
    console.log("❌ create_sale_with_fifo source missing FOR UPDATE clause");
    failed = true;
  } else {
    console.log("✅ create_sale_with_fifo body contains FOR UPDATE");
  }

  console.log(failed ? "\n❌ Verification failed\n" : "\n✅ Migration 009 verified\n");
  process.exit(failed ? 1 : 0);
} catch (err) {
  console.error("❌ Verify failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
