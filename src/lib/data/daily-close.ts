import { createAdminClient } from "@/lib/supabase/admin";
import { yangonDayBounds } from "@/lib/business-date";
import { generateZReportSupabase } from "@/lib/data/reports";

export async function getDailyCloseStatus(businessDate: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("daily_closes")
    .select("*")
    .eq("business_date", businessDate)
    .maybeSingle();

  if (error) throw error;

  return {
    closed: !!data,
    businessDate,
    record: data,
  };
}

export async function closeBusinessDay(input: {
  businessDate: string;
  closedById: string;
  notes?: string;
}) {
  const supabase = createAdminClient();

  const status = await getDailyCloseStatus(input.businessDate);
  if (status.closed) {
    throw new Error(`Business day ${input.businessDate} is already closed`);
  }

  const report = await generateZReportSupabase(input.businessDate);

  const { data, error } = await supabase
    .from("daily_closes")
    .insert({
      business_date: input.businessDate,
      closed_by: input.closedById,
      total_sales: report.totalSales,
      cash_total: report.cashTotal,
      mobile_total: report.mobileTotal,
      credit_total: report.creditTotal,
      total_cogs: report.totalCogs,
      gross_profit: report.grossProfit,
      expense_total: report.expenseTotal,
      net_profit: report.netProfit,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  const { start, end } = yangonDayBounds(input.businessDate);
  await supabase
    .from("sales")
    .update({ daily_close_id: data.id })
    .eq("status", "COMPLETED")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .is("daily_close_id", null);

  return data;
}

export async function assertDayOpen(businessDate: string) {
  const status = await getDailyCloseStatus(businessDate);
  if (status.closed) {
    throw new Error(`Business day ${businessDate} is closed`);
  }
}
