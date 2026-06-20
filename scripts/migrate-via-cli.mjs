/**
 * Apply optional migrations via Supabase CLI (alternative to apply-optional-migrations.mjs).
 * Usage: SMOKE_INSECURE_TLS=1 node --env-file=.env.local scripts/migrate-via-cli.mjs
 */
import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

if (process.env.SMOKE_INSECURE_TLS === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const bundle = join(__dirname, "..", "supabase", "migrations", "optional_bundle.sql");
const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!existsSync(bundle)) {
  console.error("❌ optional_bundle.sql missing — run npm run migrate:bundle first");
  process.exit(1);
}

if (!dbUrl) {
  console.error("❌ Set DIRECT_URL or DATABASE_URL in .env.local");
  process.exit(1);
}

const result = spawnSync(
  "npx",
  ["supabase", "db", "query", "-f", bundle, "--db-url", dbUrl],
  { stdio: "inherit", shell: true, env: process.env }
);

if (result.status !== 0) {
  console.error("\n❌ CLI migration failed. Paste optional_bundle.sql in Supabase SQL Editor.");
  process.exit(1);
}

console.log("\n✅ Migrations applied. Run npm run migrate:check");
