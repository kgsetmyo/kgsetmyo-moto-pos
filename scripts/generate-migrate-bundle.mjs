/**
 * Generate optional_bundle.sql for Supabase SQL Editor (no DB connection needed).
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { MIGRATION_FILES } from "./db-connect.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const bundlePath = join(root, "supabase", "migrations", "optional_bundle.sql");

const parts = MIGRATION_FILES.map((file) => {
  const sql = readFileSync(join(root, "supabase", "migrations", file), "utf8").trim();
  return `-- ========== ${file} ==========\n${sql}`;
});

writeFileSync(bundlePath, `${parts.join("\n\n")}\n`, "utf8");
console.log(`✅ Wrote ${bundlePath}`);
console.log("Paste this file in Supabase Dashboard → SQL Editor → Run");
