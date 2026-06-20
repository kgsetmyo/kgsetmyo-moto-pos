/**
 * Compare stock snapshots after load-test teardown.
 *
 * Usage:
 *   node scripts/compare-stock-snapshots.mjs scripts/.load-test/before.json scripts/.load-test/after.json
 *
 * Save snapshots (avoids PowerShell redirect capturing npm stderr):
 *   node --env-file=.env.local scripts/snapshot-stock.mjs --json --out scripts/.load-test/before.json
 */
import { readFileSync } from "fs";

const [beforePath, afterPath] = process.argv.slice(2);
if (!beforePath || !afterPath) {
  console.error("Usage: node scripts/compare-stock-snapshots.mjs <before.json> <after.json>");
  process.exit(1);
}

function parseSnapshotFile(path) {
  const raw = readFileSync(path, "utf8").replace(/^\uFEFF/, "").trim();

  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    console.error(`❌ ${path} is not valid JSON.`);
    console.error("   Regenerate with:");
    console.error(
      "   node --env-file=.env.local scripts/snapshot-stock.mjs --json --out scripts/.load-test/before.json"
    );
    console.error("   Do not use: npm run snapshot:stock > file.json  (captures npm warnings on Windows)");
    process.exit(1);
  }
}

const before = parseSnapshotFile(beforePath);
const after = parseSnapshotFile(afterPath);

if (!Array.isArray(before) || !Array.isArray(after)) {
  console.error("❌ Snapshot files must contain a JSON array of { sku, totalStock } objects");
  process.exit(1);
}

const afterMap = new Map(after.map((r) => [r.sku, r.totalStock]));

let ok = true;
console.log("\n📊 Stock comparison\n");
for (const b of before) {
  const a = afterMap.get(b.sku);
  if (a !== b.totalStock) {
    console.log(`  ❌ ${b.sku}: before=${b.totalStock} after=${a ?? "missing"}`);
    ok = false;
  } else {
    console.log(`  ✅ ${b.sku}: ${b.totalStock} (restored)`);
  }
}
console.log(ok ? "\n✅ Inventory restored to pre-test levels\n" : "\n❌ Stock mismatch — re-run teardown\n");
process.exit(ok ? 0 : 1);
