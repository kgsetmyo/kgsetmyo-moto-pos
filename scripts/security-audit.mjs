/**
 * Moto POS security audit — auth, role separation, injection probes.
 * Usage: SMOKE_INSECURE_TLS=1 node --env-file=.env.local scripts/security-audit.mjs
 *
 * Env: TEST_BASE_URL (default http://localhost:3000)
 */
import { createClient } from "@supabase/supabase-js";
import { stringToBase64URL } from "@supabase/ssr";
import { loadEnvFiles } from "./load-env.mjs";
import { getAdminCredentials, getCashierCredentials } from "./test-credentials.mjs";

loadEnvFiles();

if (process.env.SMOKE_INSECURE_TLS === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } = getAdminCredentials();
const { email: CASHIER_EMAIL, password: CASHIER_PASSWORD } = getCashierCredentials();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function sessionCookie(session) {
  const ref = new URL(url).hostname.split(".")[0];
  return `sb-${ref}-auth-token=${encodeURIComponent(`base64-${stringToBase64URL(JSON.stringify(session))}`)}`;
}

async function login(email, password) {
  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return sessionCookie(data.session);
}

async function securityChecks(adminCookie, cashierCookie) {
  const findings = [];
  const checks = [
    { path: "/api/dashboard", unauth: 401 },
    { path: "/api/inventory/valuation", unauth: 401, cashier: 403 },
    { path: "/api/migrations/status", unauth: 401, cashier: 403 },
    { path: "/api/settings", unauth: 401 },
    { path: "/api/reports?type=z-report&date=2026-01-01", unauth: 401, cashier: 403 },
    { path: "/api/analytics/trends?range=30d", unauth: 401, cashier: 403 },
    { path: "/api/web-orders", unauth: 401, cashier: 200 },
    { path: "/api/store/checkout", unauth: 401 },
  ];

  for (const c of checks) {
    const unauth = await fetch(`${BASE}${c.path}`);
    if (unauth.status !== c.unauth) {
      findings.push({ severity: "HIGH", msg: `${c.path} unauth expected ${c.unauth}, got ${unauth.status}` });
    }
    if (c.cashier) {
      const res = await fetch(`${BASE}${c.path}`, { headers: { Cookie: cashierCookie } });
      if (res.status !== c.cashier) {
        findings.push({ severity: "HIGH", msg: `${c.path} cashier expected ${c.cashier}, got ${res.status}` });
      }
    }
  }

  const patchRes = await fetch(`${BASE}/api/settings`, {
    method: "PATCH",
    headers: { Cookie: cashierCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ businessName: "Hacked" }),
  });
  if (patchRes.status !== 403) {
    findings.push({ severity: "HIGH", msg: `Cashier settings PATCH expected 403, got ${patchRes.status}` });
  }

  const sqli = await fetch(`${BASE}/api/products?q=${encodeURIComponent("'; DROP TABLE products; --")}`, {
    headers: { Cookie: adminCookie },
  });
  if (sqli.status >= 500) {
    findings.push({ severity: "MEDIUM", msg: "Search with SQL-like input returned 5xx" });
  }

  const body = await sqli.text();
  if (body.includes("SERVICE_ROLE") || body.includes("service_role")) {
    findings.push({ severity: "CRITICAL", msg: "Service role key leaked in API response" });
  }

  const batchRes = await fetch(`${BASE}/api/inventory/batches?productId=00000000-0000-0000-0000-000000000001`, {
    headers: { Cookie: cashierCookie },
  });
  if (batchRes.ok) {
    const batchData = await batchRes.json();
    const leaked = (batchData.data ?? []).some((b) => "costPrice" in b);
    if (leaked) findings.push({ severity: "HIGH", msg: "Cost price exposed to cashier in batches API" });
  }

  return findings;
}

function userOnlyForgedCookie() {
  const ref = new URL(url).hostname.split(".")[0];
  const userData = {
    user: { id: "00000000-0000-0000-0000-000000000001", email: "attacker@evil.com" },
  };
  return `sb-${ref}-auth-token-user=${encodeURIComponent(`base64-${stringToBase64URL(JSON.stringify(userData))}`)}`;
}

function invalidAccessTokenCookie() {
  const session = {
    access_token:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImV4cIjoxfQ.invalid",
    user: { id: "00000000-0000-0000-0000-000000000001", email: "attacker@evil.com" },
  };
  return sessionCookie(session);
}

async function sessionHardeningChecks() {
  const findings = [];
  const forged = userOnlyForgedCookie();
  const invalid = invalidAccessTokenCookie();

  const dashboardRes = await fetch(`${BASE}/dashboard`, {
    redirect: "manual",
    headers: { Cookie: forged },
  });
  if (dashboardRes.status !== 307 && dashboardRes.status !== 302) {
    findings.push({
      severity: "HIGH",
      msg: `/dashboard forged user cookie expected redirect, got ${dashboardRes.status}`,
    });
  } else {
    const location = dashboardRes.headers.get("location") ?? "";
    if (!location.includes("/login")) {
      findings.push({
        severity: "HIGH",
        msg: `/dashboard forged cookie redirect expected /login, got ${location}`,
      });
    }
  }

  const apiRes = await fetch(`${BASE}/api/dashboard`, { headers: { Cookie: forged } });
  if (apiRes.status !== 401) {
    findings.push({
      severity: "HIGH",
      msg: `/api/dashboard forged user cookie expected 401, got ${apiRes.status}`,
    });
  }

  const invalidApi = await fetch(`${BASE}/api/dashboard`, { headers: { Cookie: invalid } });
  if (invalidApi.status !== 401) {
    findings.push({
      severity: "HIGH",
      msg: `/api/dashboard invalid JWT cookie expected 401, got ${invalidApi.status}`,
    });
  }

  return findings;
}

async function main() {
  console.log(`\n🔒 Moto POS security audit → ${BASE}\n`);

  try {
    await fetch(BASE);
  } catch {
    console.error(`❌ Cannot reach ${BASE} — run npm run dev or set TEST_BASE_URL to staging`);
    process.exit(1);
  }

  const adminCookie = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const cashierCookie = await login(CASHIER_EMAIL, CASHIER_PASSWORD);

  const findings = [
    ...(await securityChecks(adminCookie, cashierCookie)),
    ...(await sessionHardeningChecks()),
  ];

  if (findings.length === 0) {
    console.log("  ✅ Auth guards, role separation, and injection probe passed\n");
    process.exit(0);
  }

  for (const f of findings) {
    console.log(`  ❌ [${f.severity}] ${f.msg}`);
  }
  console.log();

  const fail = findings.some((f) => f.severity === "CRITICAL" || f.severity === "HIGH");
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("Security audit failed:", e.message);
  process.exit(1);
});
