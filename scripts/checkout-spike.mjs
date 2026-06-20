/**
 * Concurrent checkout spike (k6 fallback) — tags sales for teardown.
 * Usage: SMOKE_INSECURE_TLS=1 node --env-file=.env.local scripts/checkout-spike.mjs
 *
 * Env: SPIKE_CONCURRENCY=25 SPIKE_ITERATIONS=20 TEST_BASE_URL
 */
import { createClient } from "@supabase/supabase-js";
import { stringToBase64URL } from "@supabase/ssr";

if (process.env.SMOKE_INSECURE_TLS === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const CONCURRENCY = Number(process.env.SPIKE_CONCURRENCY ?? 25);
const ITERATIONS = Number(process.env.SPIKE_ITERATIONS ?? 20);
const LOAD_NOTE = process.env.LOAD_TEST_NOTE ?? "Load test automated transaction";
const EMAIL = process.env.CASHIER_EMAIL ?? "cashier@moto-parts.shop";
const PASSWORD = process.env.CASHIER_PASSWORD ?? "cashier123456";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function sessionCookie(session) {
  const ref = new URL(url).hostname.split(".")[0];
  return `sb-${ref}-auth-token=${encodeURIComponent(`base64-${stringToBase64URL(JSON.stringify(session))}`)}`;
}

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function login() {
  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error) throw new Error(error.message);
  return sessionCookie(data.session);
}

async function getProduct(cookie) {
  const res = await fetch(`${BASE}/api/products?q=SP-CLICK&pageSize=1`, { headers: { Cookie: cookie } });
  const data = await res.json();
  const product = data.data?.[0];
  if (!product?.id || !product.selling_price) throw new Error("Seed product SP-CLICK-001 missing — run npm run seed");
  return { id: product.id, price: Number(product.selling_price) };
}

async function checkout(cookie, product) {
  const start = performance.now();
  const res = await fetch(`${BASE}/api/sales`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      notes: LOAD_NOTE,
      lines: [{ productId: product.id, quantity: 1, unitPrice: product.price }],
      payments: [{ method: "CASH", amount: product.price }],
    }),
  });
  return { ms: performance.now() - start, status: res.status, ok: res.status === 201 };
}

async function main() {
  console.log(`\n⚡ Checkout spike → ${BASE}`);
  console.log(`   ${CONCURRENCY} workers × ${ITERATIONS} checkouts | note: "${LOAD_NOTE}"\n`);

  const cookie = await login();
  const product = await getProduct(cookie);

  const times = [];
  let errors = 0;
  const total = CONCURRENCY * ITERATIONS;

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const { ms, ok } = await checkout(cookie, product);
      times.push(ms);
      if (!ok) errors++;
    }
  });

  await Promise.all(workers);
  times.sort((a, b) => a - b);

  const p50 = Math.round(percentile(times, 50));
  const p95 = Math.round(percentile(times, 95));
  const p99 = Math.round(percentile(times, 99));
  const errRate = ((errors / total) * 100).toFixed(1);

  console.log(`  Requests: ${total}`);
  console.log(`  Errors:   ${errors} (${errRate}%)`);
  console.log(`  p50:      ${p50}ms`);
  console.log(`  p95:      ${p95}ms  ← concurrent write checkpoint`);
  console.log(`  p99:      ${p99}ms`);
  console.log(`  max:      ${Math.round(times[times.length - 1] ?? 0)}ms\n`);

  const pass = errors / total < 0.05 && p95 < 2000;
  console.log(pass ? "✅ Checkout spike PASS (p95 < 2s, err < 5%)\n" : "⚠️  Checkout spike NEEDS ATTENTION\n");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error("Checkout spike failed:", e.message);
  process.exit(1);
});
