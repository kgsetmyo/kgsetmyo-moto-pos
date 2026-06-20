import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/route-errors";
import { getStoreCatalog } from "@/lib/data/storefront";

export async function GET() {
  try {
    const catalog = await getStoreCatalog();
    return NextResponse.json(catalog);
  } catch (error) {
    return apiError(error, { fallback: "Failed to load catalog" });
  }
}
