import { createAdminClient } from "@/lib/supabase/admin";
import { yangonDayBounds } from "@/lib/business-date";

export async function generateZReportSupabase(businessDate: string) {
  const supabase = createAdminClient();
  const { start, end } = yangonDayBounds(businessDate);

  const { data: sales, error } = await supabase
    .from("sales")
    .select("total, total_cogs, gross_profit, payments(method, amount)")
    .eq("status", "COMPLETED")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  if (error) throw error;

  let cashTotal = 0;
  let mobileTotal = 0;
  let creditTotal = 0;
  let totalSales = 0;
  let totalCogs = 0;
  let grossProfit = 0;

  for (const sale of sales ?? []) {
    totalSales += Number(sale.total);
    totalCogs += Number(sale.total_cogs);
    grossProfit += Number(sale.gross_profit);

    for (const payment of (sale.payments as Array<{ method: string; amount: number }>) ?? []) {
      const amt = Number(payment.amount);
      if (payment.method === "CASH") cashTotal += amt;
      else if (payment.method === "MOBILE_BANKING") mobileTotal += amt;
      else if (payment.method === "CREDIT") creditTotal += amt;
    }
  }

  const { data: expenses } = await supabase
    .from("expenses")
    .select("amount")
    .eq("expense_date", businessDate);

  const expenseTotal = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);

  return {
    businessDate,
    totalSales,
    cashTotal,
    mobileTotal,
    creditTotal,
    totalCogs,
    grossProfit,
    expenseTotal,
    netProfit: grossProfit - expenseTotal,
    saleCount: sales?.length ?? 0,
  };
}

export async function getSalesReportSupabase(fromDate: string, toDate: string) {
  const supabase = createAdminClient();
  const from = yangonDayBounds(fromDate).start;
  const to = yangonDayBounds(toDate).end;

  const { data: sales, error } = await supabase
    .from("sales")
    .select("total, total_cogs, gross_profit, created_at")
    .eq("status", "COMPLETED")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString());

  if (error) throw error;

  const revenue = (sales ?? []).reduce((s, r) => s + Number(r.total), 0);
  const cogs = (sales ?? []).reduce((s, r) => s + Number(r.total_cogs), 0);
  const grossProfit = (sales ?? []).reduce((s, r) => s + Number(r.gross_profit), 0);

  const { data: expenses } = await supabase
    .from("expenses")
    .select("amount")
    .gte("expense_date", fromDate)
    .lte("expense_date", toDate);

  const expenseTotal = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);

  const dailyMap = new Map<string, { sales: number; profit: number }>();
  for (const sale of sales ?? []) {
    const date = sale.created_at.split("T")[0];
    const cur = dailyMap.get(date) ?? { sales: 0, profit: 0 };
    cur.sales += Number(sale.total);
    cur.profit += Number(sale.gross_profit);
    dailyMap.set(date, cur);
  }

  return {
    revenue,
    cogs,
    grossProfit,
    expenses: expenseTotal,
    netProfit: grossProfit - expenseTotal,
    saleCount: sales?.length ?? 0,
    dailyBreakdown: Array.from(dailyMap.entries()).map(([date, v]) => ({
      date,
      sales: v.sales,
      profit: v.profit,
    })),
  };
}
