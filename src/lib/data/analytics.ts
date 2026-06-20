import { createAdminClient } from "@/lib/supabase/admin";
import { getBusinessDateString, yangonDayBounds } from "@/lib/business-date";

export type AnalyticsRange = "30d" | "12m";

function isMissingRelation(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.message?.includes("does not exist") ||
    error.message?.includes("schema cache")
  );
}

function rangeStartDate(range: AnalyticsRange): string {
  const d = new Date();
  if (range === "12m") {
    d.setFullYear(d.getFullYear() - 1);
  } else {
    d.setDate(d.getDate() - 30);
  }
  return d.toISOString().slice(0, 10);
}

async function queryTrendsFallback(fromDate: string) {
  const supabase = createAdminClient();
  const { start } = yangonDayBounds(fromDate);
  const { data, error } = await supabase
    .from("sales")
    .select("total, gross_profit, total_cogs, created_at")
    .eq("status", "COMPLETED")
    .gte("created_at", start.toISOString());

  if (error) throw error;

  const map = new Map<
    string,
    { revenue: number; grossProfit: number; cogs: number; saleCount: number }
  >();

  for (const row of data ?? []) {
    const day = String(row.created_at).slice(0, 10);
    const cur = map.get(day) ?? { revenue: 0, grossProfit: 0, cogs: 0, saleCount: 0 };
    cur.revenue += Number(row.total);
    cur.grossProfit += Number(row.gross_profit);
    cur.cogs += Number(row.total_cogs);
    cur.saleCount += 1;
    map.set(day, cur);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([business_date, v]) => ({
      business_date,
      revenue: v.revenue,
      gross_profit: v.grossProfit,
      cogs: v.cogs,
      sale_count: v.saleCount,
    }));
}

export async function getAnalyticsTrends(range: AnalyticsRange) {
  const fromDate = rangeStartDate(range);
  const supabase = createAdminClient();

  const { data: mvData, error: mvErr } = await supabase
    .from("mv_daily_sales_analytics")
    .select("business_date, revenue, gross_profit, cogs, sale_count")
    .gte("business_date", fromDate)
    .order("business_date");

  let series;
  let source: "materialized_view" | "live" = "materialized_view";

  if (isMissingRelation(mvErr)) {
    series = await queryTrendsFallback(fromDate);
    source = "live";
  } else if (mvErr) {
    throw mvErr;
  } else {
    series = mvData ?? [];
  }

  const { data: categories, error: catErr } = await supabase
    .from("mv_daily_category_sales")
    .select("category_name, revenue, units_sold")
    .gte("business_date", fromDate);

  let topCategories: Array<{ categoryName: string; revenue: number; unitsSold: number }> = [];

  if (!catErr && categories?.length) {
    const agg = new Map<string, { revenue: number; unitsSold: number }>();
    for (const row of categories) {
      const name = String(row.category_name);
      const cur = agg.get(name) ?? { revenue: 0, unitsSold: 0 };
      cur.revenue += Number(row.revenue);
      cur.unitsSold += Number(row.units_sold);
      agg.set(name, cur);
    }
    topCategories = Array.from(agg.entries())
      .map(([categoryName, v]) => ({ categoryName, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }

  return {
    range,
    fromDate,
    toDate: getBusinessDateString(),
    series: series.map((row) => ({
      date: String(row.business_date),
      revenue: Number(row.revenue),
      grossProfit: Number(row.gross_profit),
      cogs: Number(row.cogs),
      saleCount: Number(row.sale_count),
    })),
    topCategories,
    source,
  };
}

export async function getDeadStockReport() {
  const supabase = createAdminClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const { data: products, error: pErr } = await supabase
    .from("products")
    .select("id, sku, name, category_id, categories(name)")
    .eq("is_active", true);

  if (pErr) throw pErr;

  const { data: batches, error: bErr } = await supabase
    .from("inventory_batches")
    .select("product_id, quantity_remaining, cost_price")
    .gt("quantity_remaining", 0);

  if (bErr) throw bErr;

  const { data: lineItems, error: lErr } = await supabase
    .from("sale_line_items")
    .select("product_id, sales!inner(created_at, status)")
    .eq("sales.status", "COMPLETED");

  if (lErr) throw lErr;

  const lastSold = new Map<string, string>();
  for (const row of lineItems ?? []) {
    const sales = row.sales as { created_at: string; status: string } | Array<{ created_at: string }>;
    const createdAt = Array.isArray(sales) ? sales[0]?.created_at : sales?.created_at;
    if (!createdAt) continue;
    const prev = lastSold.get(row.product_id);
    if (!prev || createdAt > prev) lastSold.set(row.product_id, createdAt);
  }

  const stockByProduct = new Map<string, { qty: number; capital: number }>();
  for (const b of batches ?? []) {
    const cur = stockByProduct.get(b.product_id) ?? { qty: 0, capital: 0 };
    const qty = Number(b.quantity_remaining);
    cur.qty += qty;
    cur.capital += qty * Number(b.cost_price);
    stockByProduct.set(b.product_id, cur);
  }

  const cutoffIso = cutoff.toISOString();
  const rows = [];

  for (const p of products ?? []) {
    const stock = stockByProduct.get(p.id);
    if (!stock || stock.qty <= 0) continue;

    const last = lastSold.get(p.id);
    if (last && last >= cutoffIso) continue;

    const cat = p.categories as { name: string } | { name: string }[] | null;
    const categoryName = Array.isArray(cat) ? cat[0]?.name : cat?.name;

    rows.push({
      productId: p.id,
      sku: p.sku,
      name: p.name,
      categoryName: categoryName ?? "—",
      quantityRemaining: stock.qty,
      tiedUpCapital: Math.round(stock.capital * 100) / 100,
      lastSoldAt: last ?? null,
      daysSinceSale: last
        ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000)
        : null,
    });
  }

  rows.sort((a, b) => b.tiedUpCapital - a.tiedUpCapital);

  return {
    cutoffDays: 90,
    totalTiedCapital: rows.reduce((s, r) => s + r.tiedUpCapital, 0),
    items: rows,
  };
}

export async function getCashierPerformance(fromDate: string, toDate: string) {
  const supabase = createAdminClient();
  const { start } = yangonDayBounds(fromDate);
  const { end } = yangonDayBounds(toDate);

  const { data: sales, error } = await supabase
    .from("sales")
    .select("total, cashier_id, cashier:profiles(full_name, email)")
    .eq("status", "COMPLETED")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  if (error) throw error;

  const map = new Map<
    string,
    { name: string; transactions: number; revenue: number }
  >();

  for (const sale of sales ?? []) {
    const id = sale.cashier_id as string;
    const profile = sale.cashier as { full_name?: string; email?: string } | null;
    const name = profile?.full_name ?? profile?.email ?? "Unknown";
    const cur = map.get(id) ?? { name, transactions: 0, revenue: 0 };
    cur.transactions += 1;
    cur.revenue += Number(sale.total);
    map.set(id, cur);
  }

  return Array.from(map.entries())
    .map(([cashierId, v]) => ({
      cashierId,
      name: v.name,
      transactionCount: v.transactions,
      totalRevenue: Math.round(v.revenue * 100) / 100,
      avgCartSize: v.transactions ? Math.round((v.revenue / v.transactions) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export async function getReorderAlerts() {
  const supabase = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data: lineItems, error: lErr } = await supabase
    .from("sale_line_items")
    .select("product_id, quantity, sales!inner(created_at, status)")
    .eq("sales.status", "COMPLETED")
    .gte("sales.created_at", since.toISOString());

  if (lErr) throw lErr;

  const velocity = new Map<string, number>();
  for (const row of lineItems ?? []) {
    velocity.set(row.product_id, (velocity.get(row.product_id) ?? 0) + Number(row.quantity));
  }

  const { data: batches, error: bErr } = await supabase
    .from("inventory_batches")
    .select("product_id, quantity_remaining")
    .gt("quantity_remaining", 0);

  if (bErr) throw bErr;

  const stock = new Map<string, number>();
  for (const b of batches ?? []) {
    stock.set(b.product_id, (stock.get(b.product_id) ?? 0) + Number(b.quantity_remaining));
  }

  const productIds = [...new Set([...velocity.keys(), ...stock.keys()])];
  if (!productIds.length) return { horizonDays: 14, items: [] };

  const { data: products, error: pErr } = await supabase
    .from("products")
    .select("id, sku, name, low_stock_threshold")
    .in("id", productIds);

  if (pErr) throw pErr;

  const items = [];

  for (const p of products ?? []) {
    const qty = stock.get(p.id) ?? 0;
    const sold30 = velocity.get(p.id) ?? 0;
    const dailyVelocity = sold30 / 30;
    if (dailyVelocity <= 0) continue;

    const daysUntilStockout = qty / dailyVelocity;
    if (daysUntilStockout >= 14) continue;

    items.push({
      productId: p.id,
      sku: p.sku,
      name: p.name,
      quantityRemaining: qty,
      dailyVelocity: Math.round(dailyVelocity * 100) / 100,
      daysUntilStockout: Math.round(daysUntilStockout * 10) / 10,
      lowStockThreshold: p.low_stock_threshold,
      urgency: daysUntilStockout < 7 ? "critical" : "warning",
    });
  }

  items.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);

  return { horizonDays: 14, items };
}
