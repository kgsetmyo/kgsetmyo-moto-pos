/**
 * Moto POS k6 load test — checkout spike + read scenarios.
 *
 * Usage:
 *   k6 run k6/stress-pos.js
 *   k6 run --env BASE_URL=http://localhost:3000 --env SCENARIO=checkout_spike k6/stress-pos.js
 *
 * Env:
 *   BASE_URL              App URL (default http://localhost:3000)
 *   SCENARIO              checkout_spike | search_load | default
 *   SUPABASE_URL          NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_ANON_KEY     NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   CASHIER_EMAIL / CASHIER_PASSWORD
 *   LOAD_TEST_NOTE        Sale notes tag for teardown (default below)
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";
import encoding from "k6/encoding";

const checkoutDuration = new Trend("checkout_duration", true);
const checkoutErrors = new Rate("checkout_errors");

const BASE = __ENV.BASE_URL || "http://localhost:3000";
const SUPABASE_URL = __ENV.SUPABASE_URL || __ENV.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || __ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = __ENV.CASHIER_EMAIL || "cashier@moto-parts.shop";
const PASSWORD = __ENV.CASHIER_PASSWORD || "cashier123456";
const LOAD_NOTE = __ENV.LOAD_TEST_NOTE || "Load test automated transaction";
const SCENARIO = __ENV.SCENARIO || "default";

export const options = (() => {
  if (SCENARIO === "checkout_spike") {
    return {
      scenarios: {
        checkout_spike: {
          executor: "ramping-vus",
          startVUs: 0,
          stages: [
            { duration: "15s", target: 25 },
            { duration: "45s", target: 25 },
            { duration: "15s", target: 0 },
          ],
          gracefulRampDown: "10s",
          exec: "checkout",
        },
      },
      thresholds: {
        checkout_duration: ["p(95)<2000"],
        checkout_errors: ["rate<0.05"],
        http_req_failed: ["rate<0.05"],
      },
    };
  }

  if (SCENARIO === "search_load") {
    return {
      scenarios: {
        search_load: {
          executor: "constant-vus",
          vus: 50,
          duration: "2m",
          exec: "search",
        },
      },
      thresholds: {
        http_req_duration: ["p(95)<800"],
        http_req_failed: ["rate<0.01"],
      },
    };
  }

  return {
    scenarios: {
      checkout_spike: {
        executor: "ramping-vus",
        startVUs: 0,
        stages: [
          { duration: "10s", target: 10 },
          { duration: "30s", target: 10 },
          { duration: "10s", target: 0 },
        ],
        exec: "checkout",
      },
      search_load: {
        executor: "constant-vus",
        vus: 20,
        duration: "1m",
        startTime: "5s",
        exec: "search",
      },
    },
    thresholds: {
      checkout_duration: ["p(95)<3000"],
      checkout_errors: ["rate<0.1"],
    },
  };
})();

function authCookie(tokenBody) {
  const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
  const now = Math.floor(Date.now() / 1000);
  const session = {
    access_token: tokenBody.access_token,
    refresh_token: tokenBody.refresh_token,
    expires_in: tokenBody.expires_in,
    expires_at: now + (tokenBody.expires_in || 3600),
    token_type: tokenBody.token_type || "bearer",
    user: tokenBody.user,
  };
  const b64 = encoding.b64encode(JSON.stringify(session), "rawurl");
  return `sb-${ref}-auth-token=${encodeURIComponent(`base64-${b64}`)}`;
}

export function setup() {
  if (!SUPABASE_URL || !ANON_KEY) {
    throw new Error("Set SUPABASE_URL and SUPABASE_ANON_KEY (or NEXT_PUBLIC_* equivalents)");
  }

  const authRes = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { apikey: ANON_KEY, "Content-Type": "application/json" } }
  );

  if (authRes.status !== 200) {
    throw new Error(`Auth failed: ${authRes.status} ${authRes.body}`);
  }

  const tokenBody = authRes.json();
  const cookie = authCookie(tokenBody);

  const prodRes = http.get(`${BASE}/api/products?q=SP-CLICK&pageSize=1`, {
    headers: { Cookie: cookie },
  });

  if (prodRes.status !== 200) {
    throw new Error(`Product lookup failed: ${prodRes.status}`);
  }

  const products = prodRes.json();
  const product = products.data?.[0];
  if (!product?.id || !product.selling_price) {
    throw new Error("No seeded product SP-CLICK — run npm run seed");
  }

  return {
    cookie,
    productId: product.id,
    unitPrice: Number(product.selling_price),
  };
}

export function checkout(data) {
  const body = JSON.stringify({
    notes: LOAD_NOTE,
    lines: [{ productId: data.productId, quantity: 1, unitPrice: data.unitPrice }],
    payments: [{ method: "CASH", amount: data.unitPrice }],
  });

  const res = http.post(`${BASE}/api/sales`, body, {
    headers: {
      Cookie: data.cookie,
      "Content-Type": "application/json",
    },
    tags: { name: "checkout" },
  });

  const ok = check(res, {
    "checkout status 201": (r) => r.status === 201,
  });

  checkoutDuration.add(res.timings.duration);
  checkoutErrors.add(!ok);

  sleep(0.1);
}

export function search(data) {
  const res = http.get(`${BASE}/api/products?q=spark&pageSize=20`, {
    headers: { Cookie: data.cookie },
    tags: { name: "search" },
  });

  check(res, {
    "search status 200": (r) => r.status === 200,
  });

  sleep(0.2);
}
