/**
 * Run teardown-load-test.sql via session pooler (DIRECT_URL).
 * Usage: SMOKE_INSECURE_TLS=1 node --env-file=.env.local scripts/teardown-via-cli.mjs
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { connectPostgres } from "./db-connect.mjs";

if (process.env.SMOKE_INSECURE_TLS === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "teardown-load-test.sql"), "utf8");
const { client } = await connectPostgres();

console.log("\n🧹 Running teardown-load-test.sql\n");

try {
  await client.query(sql);
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS remaining FROM sales WHERE notes = 'Load test automated transaction'`
  );
  console.log(`✅ Teardown complete — load-test sales remaining: ${rows[0].remaining}\n`);
} catch (err) {
  console.error("❌ Teardown failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
