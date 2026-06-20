import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/route-errors";
import { searchStoreProducts } from "@/lib/data/storefront";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(48, Math.max(1, parseInt(searchParams.get("pageSize") ?? "24", 10)));

    const result = await searchStoreProducts({
      q: searchParams.get("q") ?? undefined,
      bikeBrand: searchParams.get("bikeBrand") ?? undefined,
      bikeModel: searchParams.get("bikeModel") ?? undefined,
      year: searchParams.get("year") ?? undefined,
      page,
      pageSize,
    });

    return NextResponse.json({
      ...result,
      page,
      pageSize,
    });
  } catch (error) {
    return apiError(error, { fallback: "Failed to load products" });
  }
}
