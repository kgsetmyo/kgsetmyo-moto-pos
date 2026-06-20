/**
 * Load .env then .env.local into process.env (local overrides).
 * Values already present in process.env (e.g. GitHub Actions job env) are never overwritten.
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function presetEnvKeys() {
  return new Set(
    Object.entries(process.env)
      .filter(([, value]) => value !== undefined && value !== "")
      .map(([key]) => key)
  );
}

function parseEnvFile(envPath, skipKeys) {
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (skipKeys.has(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

/** @deprecated use loadEnvFiles */
export function loadEnvLocal() {
  loadEnvFiles();
}

export function loadEnvFiles() {
  const skipKeys = presetEnvKeys();
  parseEnvFile(join(root, ".env"), skipKeys);
  parseEnvFile(join(root, ".env.local"), skipKeys);
}
