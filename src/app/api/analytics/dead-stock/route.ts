import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { getDeadStockReport } from "@/lib/data/analytics";

export async function GET() {
  try {
    await requireProfile(["ADMIN"]);
    const data = await getDeadStockReport();
    return NextResponse.json(data);
  } catch (error) {
    return apiError(error, { fallback: "Failed to load dead stock report" });
  }
}
