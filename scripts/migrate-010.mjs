/**
 * Apply migration 010_analytics_mv.sql via session pooler (DIRECT_URL).
 * Usage: SMOKE_INSECURE_TLS=1 node --env-file=.env.local scripts/migrate-010.mjs
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadEnvLocal } from "./load-env.mjs";
import { connectPostgres } from "./db-connect.mjs";

loadEnvLocal();

if (process.env.SMOKE_INSECURE_TLS === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "..", "supabase", "migrations", "010_analytics_mv.sql");
const sql = readFileSync(sqlPath, "utf8");
const { client, connectionString } = await connectPostgres();

console.log(`\n📦 Applying 010_analytics_mv.sql`);
console.log(`   via ${connectionString.replace(/:[^:@]+@/, ":****@")}\n`);

try {
  await client.query(sql);
  console.log("✅ Migration 010 applied successfully\n");
} catch (err) {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
