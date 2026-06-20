import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { getLowStockProducts } from "@/lib/data/inventory";

export async function GET() {
  try {
    await requireProfile(["ADMIN", "CASHIER"]);
    const products = await getLowStockProducts();
    return NextResponse.json({ data: products, total: products.length });
  } catch (error) {
    return apiError(error, { fallback: "Failed to load low stock" });
  }
}
