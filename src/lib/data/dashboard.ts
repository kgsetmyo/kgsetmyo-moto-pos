import { createAdminClient } from "@/lib/supabase/admin";
import { getBusinessDateString, yangonDayBounds } from "@/lib/business-date";

export async function getDashboardStatsSupabase() {
  const supabase = createAdminClient();
  const businessDate = getBusinessDateString();
  const { start, end } = yangonDayBounds(businessDate);

  const [salesRes, creditRes, lowStockListRes, lowStockCountRes, recentRes] = await Promise.all([
    supabase
      .from("sales")
      .select("total, gross_profit")
      .eq("status", "COMPLETED")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString()),
    supabase.from("customers").select("credit_balance").eq("is_active", true),
    supabase
      .from("product_stock_view")
      .select("product_id, sku, name, total_stock, low_stock_threshold, is_low_stock")
      .eq("is_low_stock", true)
      .limit(8),
    supabase
      .from("product_stock_view")
      .select("product_id", { count: "exact", head: true })
      .eq("is_low_stock", true),
    supabase
      .from("sales")
      .select("id, invoice_number, total, status, created_at, cashier:profiles(full_name)")
      .eq("status", "COMPLETED")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  if (salesRes.error) throw salesRes.error;
  if (creditRes.error) throw creditRes.error;

  const todaySales = (salesRes.data ?? []).reduce((s, r) => s + Number(r.total), 0);
  const todayProfit = (salesRes.data ?? []).reduce((s, r) => s + Number(r.gross_profit), 0);
  const pendingCredit = (creditRes.data ?? []).reduce(
    (s, r) => s + Number(r.credit_balance),
    0
  );

  const lowStock = lowStockListRes.error
    ? []
    : (lowStockListRes.data ?? []).map((p) => ({
        id: p.product_id,
        sku: p.sku,
        name: p.name,
        totalStock: Number(p.total_stock),
        threshold: p.low_stock_threshold,
        isLowStock: true,
      }));

  const recentSales = recentRes.error
    ? []
    : (recentRes.data ?? []).map((s) => {
        const cashier = s.cashier as { full_name?: string } | null;
        return {
          id: s.id,
          invoiceNumber: s.invoice_number,
          total: Number(s.total),
          status: s.status,
          createdAt: s.created_at,
          cashierName: cashier?.full_name ?? "—",
        };
      });

  return {
    todaySales,
    todayProfit,
    lowStockCount: lowStockCountRes.count ?? lowStock.length,
    pendingCredit,
    lowStock,
    recentSales,
  };
}
