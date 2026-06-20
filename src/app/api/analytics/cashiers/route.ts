import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { getCashierPerformance } from "@/lib/data/analytics";
import { getBusinessDateString } from "@/lib/business-date";

export async function GET(request: NextRequest) {
  try {
    await requireProfile(["ADMIN"]);
    const { searchParams } = request.nextUrl;
    const today = getBusinessDateString();
    const from = searchParams.get("from") ?? today;
    const to = searchParams.get("to") ?? today;
    const data = await getCashierPerformance(from, to);
    return NextResponse.json({ from, to, cashiers: data });
  } catch (error) {
    return apiError(error, { fallback: "Failed to load cashier performance" });
  }
}
