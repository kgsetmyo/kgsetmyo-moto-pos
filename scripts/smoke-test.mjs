/**
 * Moto POS smoke tests — pages, auth, API flows, checkout.
 * Usage: SMOKE_INSECURE_TLS=1 npm run test:smoke
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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function ciSmokeNote() {
  const base = process.env.CI_SMOKE_NOTE ?? "CI smoke test transaction";
  const runId = process.env.GITHUB_RUN_ID?.trim();
  return runId ? `${base} (run ${runId})` : base;
}

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✅ ${label}`);
  passed++;
}

function fail(label, detail) {
  console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
  failed++;
}

function sessionCookie(session) {
  const ref = new URL(url).hostname.split(".")[0];
  const cookieName = `sb-${ref}-auth-token`;
  const cookieValue = `base64-${stringToBase64URL(JSON.stringify(session))}`;
  return `${cookieName}=${encodeURIComponent(cookieValue)}`;
}

async function api(path, { cookie, method = "GET", body, expect } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (expect !== undefined && res.status !== expect) {
    fail(path, `expected ${expect}, got ${res.status} — ${JSON.stringify(data).slice(0, 120)}`);
    return { res, data, ok: false };
  }
  return { res, data, ok: true };
}

async function login(email, password) {
  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return {
    supabase,
    userId: data.user.id,
    cookie: sessionCookie(data.session),
    session: data.session,
  };
}

async function testPages() {
  console.log("\n📄 Page routes");
  for (const path of ["/login", "/dashboard", "/pos", "/sales", "/inventory", "/customers", "/reports", "/analytics", "/settings", "/web-orders", "/shop"]) {
    try {
      const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
      const valid = res.status === 200 || res.status === 307 || res.status === 308;
      if (valid) ok(`${path} → ${res.status}`);
      else fail(path, `status ${res.status}`);
    } catch (e) {
      fail(path, e.message);
    }
  }
}

async function testAuth() {
  console.log("\n🔐 Supabase auth");
  if (!url || !anonKey) {
    fail("env vars", "missing SUPABASE_URL or ANON_KEY");
    return null;
  }

  try {
    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    ok(`admin login as ${ADMIN_EMAIL}`);

    const { data: profile } = await admin.supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", admin.userId)
      .single();

    if (profile?.role === "ADMIN") ok(`profile role = ADMIN (${profile.full_name})`);
    else fail("profile role", `expected ADMIN, got ${profile?.role}`);

    return admin;
  } catch (e) {
    fail("admin login", e.message);
    return null;
  }
}

async function testAuthenticatedApi(admin) {
  console.log("\n🔑 Authenticated API routes");
  const { cookie } = admin;

  for (const path of [
    "/api/me",
    "/api/dashboard",
    "/api/products?q=spark&pageSize=5",
    "/api/catalog",
    "/api/customers?page=1",
    "/api/sales?page=1",
    "/api/inventory/valuation",
    "/api/inventory/low-stock",
    "/api/settings",
    `/api/reports?type=day-status&date=${new Date().toISOString().slice(0, 10)}`,
  ]) {
    const { ok: success } = await api(path, { cookie, expect: 200 });
    if (success) ok(`${path} → 200`);
  }
}

async function testAdminReports(admin) {
  console.log("\n📊 Admin reports");
  const today = new Date().toISOString().slice(0, 10);
  const { ok: zOk } = await api(`/api/reports?type=z-report&date=${today}`, {
    cookie: admin.cookie,
    expect: 200,
  });
  if (zOk) ok(`z-report for ${today}`);

  const from = today;
  const to = today;
  const { ok: rangeOk } = await api(`/api/reports?from=${from}&to=${to}`, {
    cookie: admin.cookie,
    expect: 200,
  });
  if (rangeOk) ok("date-range report");

  const { data: migData, ok: migOk } = await api("/api/migrations/status", {
    cookie: admin.cookie,
    expect: 200,
  });
  if (migOk) {
    const pending = migData.pending?.length ?? 0;
    ok(`migration status — ${pending} pending`);
  }
}

async function testStorefrontPublic() {
  console.log("\n🛍️  Storefront (public)");
  for (const path of ["/api/store/catalog", "/api/store/products?page=1&pageSize=5"]) {
    const { ok: success, res } = await api(path, { expect: 200 });
    if (success) ok(`${path.split("?")[0]} → 200`);
    else fail(path, `status ${res.status}`);
  }

  const bodyText = JSON.stringify(await (await fetch(`${BASE}/api/store/products?page=1&pageSize=3`)).json());
  if (bodyText.includes("cost_price") || bodyText.includes("costPrice")) {
    fail("storefront masking", "cost_price leaked in public API");
  } else {
    ok("public products omit cost_price");
  }
}

async function testWebOrdersApi(admin) {
  console.log("\n📦 Web orders API");
  const { ok: success } = await api("/api/web-orders", { cookie: admin.cookie, expect: 200 });
  if (success) ok("/api/web-orders → 200");
}

async function testAdminAnalytics(admin) {
  console.log("\n📈 Admin analytics");
  for (const path of [
    "/api/analytics/trends?range=30d",
    "/api/analytics/dead-stock",
    "/api/analytics/reorder-alerts",
    `/api/analytics/cashiers?from=${new Date().toISOString().slice(0, 10)}&to=${new Date().toISOString().slice(0, 10)}`,
  ]) {
    const { ok: success } = await api(path, { cookie: admin.cookie, expect: 200 });
    if (success) ok(`${path.split("?")[0]} → 200`);
  }
}

async function testCashierDenied() {
  console.log("\n👤 Cashier role guard");
  try {
    const cashier = await login(CASHIER_EMAIL, CASHIER_PASSWORD);
    const today = new Date().toISOString().slice(0, 10);
    const { res } = await api(`/api/reports?type=z-report&date=${today}`, {
      cookie: cashier.cookie,
    });
    if (res.status === 403) ok("cashier blocked from z-report → 403");
    else fail("cashier z-report", `expected 403, got ${res.status}`);

    const { res: valRes } = await api("/api/inventory/valuation", { cookie: cashier.cookie });
    if (valRes.status === 403) ok("cashier blocked from inventory valuation → 403");
    else fail("cashier valuation", `expected 403, got ${valRes.status}`);

    const { res: settingsRes } = await api("/api/settings", {
      cookie: cashier.cookie,
      method: "PATCH",
      body: { businessName: "Hacked" },
    });
    if (settingsRes.status === 403) ok("cashier blocked from settings update → 403");
    else fail("cashier settings", `expected 403, got ${settingsRes.status}`);

    const { res: migRes } = await api("/api/migrations/status", { cookie: cashier.cookie });
    if (migRes.status === 403) ok("cashier blocked from migration status → 403");
    else fail("cashier migration status", `expected 403, got ${migRes.status}`);

    const { res: analyticsRes } = await api("/api/analytics/trends?range=30d", {
      cookie: cashier.cookie,
    });
    if (analyticsRes.status === 403) ok("cashier blocked from analytics → 403");
    else fail("cashier analytics", `expected 403, got ${analyticsRes.status}`);

    await cashier.supabase.auth.signOut();
  } catch (e) {
    fail("cashier login", e.message);
  }
}

async function testCheckout(admin) {
  console.log("\n🛒 POS checkout (FIFO)");
  const { data: products, ok: searchOk } = await api("/api/products?q=SP-CLICK&pageSize=1", {
    cookie: admin.cookie,
    expect: 200,
  });
  if (!searchOk) return null;

  const product = products.data?.[0];
  if (!product?.id) {
    fail("find product", "no seeded product SP-CLICK-001 — run npm run seed");
    return null;
  }

  ok(`found product ${product.sku} (stock ${product.total_stock})`);
  const price = Number(product.selling_price);
  if (!price) {
    fail("product price", "missing selling_price");
    return null;
  }

  const { res, data, ok: saleOk } = await api("/api/sales", {
    cookie: admin.cookie,
    method: "POST",
    body: {
      lines: [{ productId: product.id, quantity: 1, unitPrice: price }],
      payments: [{ method: "CASH", amount: price }],
      notes: ciSmokeNote(),
    },
  });

  if (saleOk && res.status === 201) {
    ok(`cash sale created — invoice ${data.invoice_number ?? data.invoiceNumber ?? "ok"}`);
    return data.id ?? null;
  } else {
    fail("checkout", `status ${res.status} — ${JSON.stringify(data).slice(0, 160)}`);
    return null;
  }
}

async function testVoidSale(admin, saleId) {
  if (!saleId) return;
  console.log("\n↩️  Sale void");
  const { res, data, ok: voidOk } = await api(`/api/sales/${saleId}/void`, {
    cookie: admin.cookie,
    method: "POST",
    body: { reason: "Smoke test void" },
    expect: 200,
  });
  if (voidOk) {
    ok(`sale voided — ${data.invoice_number ?? data.invoiceNumber ?? saleId}`);
    return;
  }
  fail("void sale", `status ${res.status} — ${JSON.stringify(data).slice(0, 160)}`);
}

async function testSaleDetail(admin, saleId) {
  if (!saleId) return;
  console.log("\n🧾 Sale detail");
  const { ok: detailOk } = await api(`/api/sales/${saleId}`, {
    cookie: admin.cookie,
    expect: 200,
  });
  if (detailOk) ok("sale detail with line items");
}

async function testCustomerFlow(admin) {
  console.log("\n👥 Customer create & edit");
  const unique = `Smoke Test ${Date.now()}`;
  const { res, data, ok: createOk } = await api("/api/customers", {
    cookie: admin.cookie,
    method: "POST",
    body: { name: unique, phone: "0999999999", creditLimit: 500000 },
    expect: 201,
  });
  if (!createOk) {
    fail("create customer", `status ${res.status}`);
    return;
  }
  ok(`customer created: ${data.name ?? unique}`);

  const customerId = data.id;
  const { ok: patchOk } = await api(`/api/customers/${customerId}`, {
    cookie: admin.cookie,
    method: "PATCH",
    body: { creditLimit: 600000 },
    expect: 200,
  });
  if (patchOk) ok("customer credit limit updated");
}

async function testExpenses(admin) {
  console.log("\n💸 Expenses API");
  const today = new Date().toISOString().slice(0, 10);
  const { ok: listOk } = await api(`/api/expenses?from=${today}&to=${today}`, {
    cookie: admin.cookie,
    expect: 200,
  });
  if (listOk) ok("expenses list");
}

async function testSettingsUpdate(admin) {
  console.log("\n⚙️  Shop settings");
  const { data, ok: patchOk } = await api("/api/settings", {
    cookie: admin.cookie,
    method: "PATCH",
    body: { businessName: "Moto Parts POS" },
    expect: 200,
  });
  if (patchOk) ok(`settings saved — ${data.businessName}`);
}

async function testBikeSearch(admin) {
  console.log("\n🏍️  Bike compatibility search");
  const { data, ok: searchOk } = await api("/api/products?bikeBrand=Honda&pageSize=5", {
    cookie: admin.cookie,
    expect: 200,
  });
  if (searchOk) ok(`bike search → ${data.data?.length ?? 0} product(s)`);
}

async function testApiUnauthenticated() {
  console.log("\n🔒 API auth guard");
  for (const path of ["/api/dashboard", "/api/products?q=test", "/api/sales"]) {
    const { res } = await api(path, { method: path.includes("sales") ? "POST" : "GET", body: path.includes("sales") ? {} : undefined });
    if (res.status === 401) ok(`${path} → 401`);
    else fail(path, `expected 401, got ${res.status}`);
  }
}

async function findProduct(admin, q = "SP-CLICK") {
  const { data, ok: searchOk } = await api(`/api/products?q=${encodeURIComponent(q)}&pageSize=1`, {
    cookie: admin.cookie,
    expect: 200,
  });
  if (!searchOk) return null;
  return data.data?.[0] ?? null;
}

async function ensureSmokeStock(admin, minStock = 25) {
  console.log("\n📥 Ensure test stock");
  const product = await findProduct(admin);
  if (!product?.id) {
    fail("ensure stock", "no seeded product SP-CLICK-001 — run npm run seed");
    return null;
  }

  const stock = Number(product.total_stock);
  if (stock >= minStock) {
    ok(`test stock OK (${stock} units)`);
    return product;
  }

  const receiveQty = minStock - stock;
  const price = Number(product.selling_price) || 4500;
  const { res, data, ok: receiveOk } = await api("/api/inventory/batches", {
    cookie: admin.cookie,
    method: "POST",
    body: {
      productId: product.id,
      costPrice: Math.round(price * 0.55),
      sellingPrice: price,
      quantity: receiveQty,
      batchNumber: `SMOKE-${Date.now()}`,
    },
    expect: 201,
  });

  if (receiveOk) {
    ok(`received ${receiveQty} units for smoke tests (was ${stock})`);
    return { ...product, total_stock: stock + receiveQty };
  }

  fail("ensure stock", `status ${res.status} — ${JSON.stringify(data).slice(0, 120)}`);
  return null;
}

async function testStockAdjust(admin) {
  console.log("\n📦 Stock adjustment");
  const product = await findProduct(admin);
  if (!product?.id || Number(product.total_stock) < 1) {
    console.log("  ⏭️  skipped — no stock");
    return;
  }
  const { data, ok: adjustOk } = await api("/api/inventory/adjust", {
    cookie: admin.cookie,
    method: "POST",
    body: {
      productId: product.id,
      quantity: 1,
      reason: "Smoke test adjustment",
    },
    expect: 201,
  });
  if (adjustOk) ok(`adjusted stock — removed ${data.quantityRemoved}`);
}

async function testAdjustmentsList(admin) {
  console.log("\n📋 Adjustment history");
  const { data, ok: listOk } = await api("/api/inventory/adjustments?page=1&pageSize=5", {
    cookie: admin.cookie,
    expect: 200,
  });
  if (listOk) {
    if (data.tableMissing) {
      console.log("  ⚠️  inventory_adjustments table missing (optional migration 006)");
    } else {
      ok(`adjustments list — ${data.data?.length ?? 0} row(s)`);
    }
  }
}

async function testCashierNoBatchCost(admin) {
  console.log("\n🔐 Cashier cost-price guard");
  const product = await findProduct(admin);
  if (!product?.id) return;
  try {
    const cashier = await login(CASHIER_EMAIL, CASHIER_PASSWORD);
    const { res, data } = await api(`/api/inventory/batches?productId=${product.id}`, {
      cookie: cashier.cookie,
      expect: 200,
    });
    if (res.status !== 200) {
      fail("cashier batches", `status ${res.status}`);
      await cashier.supabase.auth.signOut();
      return;
    }
    const batches = data.data ?? [];
    const leaked = batches.some((b) => "costPrice" in b && b.costPrice != null);
    if (leaked) fail("cashier batch cost", "costPrice exposed to cashier");
    else ok(`cashier batches omit costPrice (${batches.length} batch(es))`);
    await cashier.supabase.auth.signOut();
  } catch (e) {
    fail("cashier batch guard", e.message);
  }
}

async function testCustomerDeactivate(admin) {
  console.log("\n🚫 Customer deactivate");
  const unique = `Deactivate ${Date.now()}`;
  const { data, ok: createOk } = await api("/api/customers", {
    cookie: admin.cookie,
    method: "POST",
    body: { name: unique, phone: "0988888888" },
    expect: 201,
  });
  if (!createOk) return;
  const { ok: delOk } = await api(`/api/customers/${data.id}`, {
    cookie: admin.cookie,
    method: "DELETE",
    expect: 200,
  });
  if (delOk) ok(`customer deactivated — ${unique}`);
}

async function testSplitPayment(admin) {
  console.log("\n💳 Split payment checkout");
  const product = await findProduct(admin);
  if (!product?.id) return;
  const price = Number(product.selling_price);
  const half = Math.floor(price / 2);
  const other = price - half;
  const { ok: saleOk, res, data } = await api("/api/sales", {
    cookie: admin.cookie,
    method: "POST",
    body: {
      lines: [{ productId: product.id, quantity: 1, unitPrice: price }],
      payments: [
        { method: "CASH", amount: half },
        {
          method: "MOBILE_BANKING",
          amount: other,
          slipUrl: "https://placehold.co/100x100.png",
        },
      ],
      notes: ciSmokeNote(),
    },
  });
  if (saleOk && res.status === 201) {
    ok(`split payment sale — ${data.invoice_number ?? data.invoiceNumber ?? "ok"}`);
    return;
  }
  fail("split payment", `status ${res.status} — ${JSON.stringify(data).slice(0, 120)}`);
}

async function testOversell(admin) {
  console.log("\n⛔ Oversell guard");
  const product = await findProduct(admin);
  if (!product?.id) return;
  const stock = Number(product.total_stock);
  const price = Number(product.selling_price);
  const { res } = await api("/api/sales", {
    cookie: admin.cookie,
    method: "POST",
    body: {
      lines: [{ productId: product.id, quantity: stock + 1000, unitPrice: price }],
      payments: [{ method: "CASH", amount: price * (stock + 1000) }],
    },
  });
  if (res.status === 409 || res.status === 400) ok(`oversell blocked → ${res.status}`);
  else fail("oversell guard", `expected 409/400, got ${res.status}`);
}

async function testCreditFlow(admin) {
  console.log("\n💰 Credit sale & payment");
  const product = await findProduct(admin);
  if (!product?.id) return;
  const price = Number(product.selling_price);
  const unique = `Credit ${Date.now()}`;
  const { data: customer, ok: createOk } = await api("/api/customers", {
    cookie: admin.cookie,
    method: "POST",
    body: { name: unique, creditLimit: price * 10 },
    expect: 201,
  });
  if (!createOk) return;

  const { res: saleRes, data: saleData, ok: saleOk } = await api("/api/sales", {
    cookie: admin.cookie,
    method: "POST",
    body: {
      customerId: customer.id,
      lines: [{ productId: product.id, quantity: 1, unitPrice: price }],
      payments: [{ method: "CREDIT", amount: price }],
      notes: ciSmokeNote(),
    },
  });
  if (!saleOk || saleRes.status !== 201) {
    const detail = JSON.stringify(saleData);
    if (
      (detail.includes("payment_method") && detail.includes("CREDIT")) ||
      detail.includes("migration 008")
    ) {
      console.log("  ⚠️  CREDIT missing from payment_method enum — run migration 008");
      return;
    }
    fail("credit sale", `status ${saleRes.status} — ${detail.slice(0, 120)}`);
    return;
  }
  ok("credit sale created");

  const { res: payRes, data: payData, ok: payOk } = await api("/api/customers", {
    cookie: admin.cookie,
    method: "POST",
    body: {
      customerId: customer.id,
      amount: price,
      method: "CASH",
      notes: "Smoke test payment",
    },
    expect: 201,
  });
  if (payOk) ok(`credit payment recorded — balance ${payData.newBalance ?? "ok"}`);
  else fail("credit payment", `status ${payRes.status}`);
}

async function testCatalogBikeBrand(admin) {
  console.log("\n🏍️  Catalog bike brand upsert");
  const name = `SmokeBrand${Date.now()}`;
  const { res, data, ok: postOk } = await api("/api/catalog", {
    cookie: admin.cookie,
    method: "POST",
    body: { type: "bikeBrand", name },
    expect: 201,
  });
  if (postOk && data.id) ok(`bike brand created — ${name}`);
  else fail("catalog bike brand", `status ${res.status}`);
}

async function testMigrations() {
  console.log("\n🗄️  Database migrations");
  if (!serviceKey) {
    console.log("  ⏭️  Skipped RPC check — no service role key");
    return;
  }
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await supabase.rpc("create_sale_with_fifo", {
    p_cashier_id: "00000000-0000-0000-0000-000000000001",
    p_lines: [],
    p_payments: [],
  });
  if (error?.message?.includes("Could not find the function")) {
    fail("create_sale_with_fifo", "run migration 003");
  } else {
    ok("create_sale_with_fifo RPC installed");
  }

  const { error: payErr } = await supabase.rpc("record_credit_payment", {
    p_customer_id: "00000000-0000-0000-0000-000000000001",
    p_amount: 1,
    p_method: "CASH",
    p_reference: null,
    p_notes: null,
    p_recorded_by: "00000000-0000-0000-0000-000000000001",
  });
  if (payErr?.message?.includes("Could not find the function")) {
    console.log("  ⚠️  record_credit_payment not installed (optional migration 005)");
  } else {
    ok("record_credit_payment RPC installed");
  }

  const { error: voidErr } = await supabase.rpc("void_sale_with_fifo", {
    p_sale_id: "00000000-0000-0000-0000-000000000001",
    p_voided_by: "00000000-0000-0000-0000-000000000001",
    p_reason: "smoke check",
  });
  if (voidErr?.message?.includes("Could not find the function")) {
    console.log("  ⚠️  void_sale_with_fifo not installed (optional migration 007)");
  } else {
    ok("void_sale_with_fifo RPC installed");
  }
}

async function main() {
  console.log(`\n🧪 Moto POS smoke tests → ${BASE}`);

  try {
    await fetch(BASE);
    ok("dev server reachable");
  } catch {
    fail("dev server", `cannot reach ${BASE} — run npm run dev first`);
    console.log(`\n${passed} passed, ${failed} failed\n`);
    process.exit(1);
  }

  await testPages();
  await testStorefrontPublic();
  const admin = await testAuth();
  await testApiUnauthenticated();
  await testMigrations();

  if (admin) {
    await testAuthenticatedApi(admin);
    await testAdminReports(admin);
    await testAdminAnalytics(admin);
    await testWebOrdersApi(admin);
    await testCashierDenied();
    await testCustomerFlow(admin);
    await testCustomerDeactivate(admin);
    await testCatalogBikeBrand(admin);
    await ensureSmokeStock(admin);
    await testStockAdjust(admin);
    await testAdjustmentsList(admin);
    await testExpenses(admin);
    await testSettingsUpdate(admin);
    await testBikeSearch(admin);
    await testCreditFlow(admin);
    await testSplitPayment(admin);
    await testOversell(admin);
    await testCashierNoBatchCost(admin);
    const saleId = await testCheckout(admin);
    await testSaleDetail(admin, saleId);
    await testVoidSale(admin, saleId);
  }

  console.log(`\n${"─".repeat(30)}`);
  console.log(`${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
