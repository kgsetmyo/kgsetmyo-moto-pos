import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { toCsv } from "@/lib/csv";
import { getLowStockProducts } from "@/lib/data/inventory";

export async function GET() {
  try {
    await requireProfile(["ADMIN"]);
    const products = await getLowStockProducts();
    const csv = toCsv(
      products.map((p) => ({
        sku: p.sku,
        name: p.name,
        stock: p.totalStock,
        threshold: p.threshold,
        shortfall: p.shortfall,
      })),
      ["sku", "name", "stock", "threshold", "shortfall"]
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="low-stock-report.csv"',
      },
    });
  } catch (error) {
    return apiError(error, { fallback: "Export failed" });
  }
}
