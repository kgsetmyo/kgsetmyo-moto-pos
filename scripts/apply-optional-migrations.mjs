/**
 * Apply optional Supabase migrations 008, 005–007 via direct Postgres connection.
 * Usage: SMOKE_INSECURE_TLS=1 node --env-file=.env.local scripts/apply-optional-migrations.mjs
 *
 * If direct DB is unreachable, paste supabase/migrations/optional_bundle.sql in SQL Editor.
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { connectPostgres, MIGRATION_FILES } from "./db-connect.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const bundlePath = join(root, "supabase", "migrations", "optional_bundle.sql");

function writeBundle() {
  const parts = MIGRATION_FILES.map((file) => {
    const sql = readFileSync(join(root, "supabase", "migrations", file), "utf8").trim();
    return `-- ========== ${file} ==========\n${sql}`;
  });
  const bundle = `${parts.join("\n\n")}\n`;
  writeFileSync(bundlePath, bundle, "utf8");
  return bundlePath;
}

let client;
try {
  writeBundle();
  const connected = await connectPostgres();
  client = connected.client;
  console.log(`✅ Connected to Postgres\n`);

  for (const file of MIGRATION_FILES) {
    const path = join(root, "supabase", "migrations", file);
    const sql = readFileSync(path, "utf8");
    process.stdout.write(`Applying ${file}… `);
    try {
      await client.query(sql);
      console.log("OK");
    } catch (err) {
      console.log("FAILED");
      console.error(`  ${err.message}`);
    }
  }

  console.log("\nRun npm run migrate:check to verify.");
} catch (err) {
  const bundle = writeBundle();
  console.error("❌ Connection failed:", err.message);
  console.error(`\nPaste this file in Supabase SQL Editor:\n  ${bundle}\n`);
  process.exit(1);
} finally {
  if (client) await client.end().catch(() => {});
}
