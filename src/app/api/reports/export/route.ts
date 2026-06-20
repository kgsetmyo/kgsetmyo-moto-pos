import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { generateZReportSupabase, getSalesReportSupabase } from "@/lib/data/reports";

function csvResponse(filename: string, content: string) {
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    await requireProfile(["ADMIN"]);
    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type") ?? "range";

    if (type === "z-report") {
      const date = searchParams.get("date");
      if (!date) {
        return NextResponse.json({ error: "date required" }, { status: 400 });
      }

      const report = await generateZReportSupabase(date);
      const csv = toCsv(
        [
          {
            business_date: report.businessDate,
            total_sales: report.totalSales,
            cash: report.cashTotal,
            mobile: report.mobileTotal,
            credit: report.creditTotal,
            cogs: report.totalCogs,
            gross_profit: report.grossProfit,
            expenses: report.expenseTotal,
            net_profit: report.netProfit,
            sale_count: report.saleCount,
          },
        ],
        [
          "business_date",
          "total_sales",
          "cash",
          "mobile",
          "credit",
          "cogs",
          "gross_profit",
          "expenses",
          "net_profit",
          "sale_count",
        ]
      );

      return csvResponse(`z-report-${date}.csv`, csv);
    }

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (!from || !to) {
      return NextResponse.json({ error: "from and to required" }, { status: 400 });
    }

    const report = await getSalesReportSupabase(from, to);
    const summary = toCsv(
      [
        {
          from,
          to,
          revenue: report.revenue,
          cogs: report.cogs,
          gross_profit: report.grossProfit,
          expenses: report.expenses,
          net_profit: report.netProfit,
          sale_count: report.saleCount,
        },
      ],
      ["from", "to", "revenue", "cogs", "gross_profit", "expenses", "net_profit", "sale_count"]
    );

    const daily = toCsv(
      report.dailyBreakdown.map((d) => ({
        date: d.date,
        sales: d.sales,
        profit: d.profit,
      })),
      ["date", "sales", "profit"]
    );

    return csvResponse(`sales-report-${from}-to-${to}.csv`, `${summary}\r\n\r\n${daily}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
