/**
 * Dev server — optional TLS workaround for corporate proxies on Windows.
 * Set DEV_INSECURE_TLS=0 to disable.
 */
if (process.env.NODE_ENV !== "production" && process.env.DEV_INSECURE_TLS !== "0") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";
}

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const nextBin = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "node_modules",
  "next",
  "dist",
  "bin",
  "next"
);

const child = spawn(process.execPath, [nextBin, "dev"], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
