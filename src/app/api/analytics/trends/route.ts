import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { getAnalyticsTrends, type AnalyticsRange } from "@/lib/data/analytics";

export async function GET(request: NextRequest) {
  try {
    await requireProfile(["ADMIN"]);
    const range = (request.nextUrl.searchParams.get("range") ?? "30d") as AnalyticsRange;
    if (range !== "30d" && range !== "12m") {
      return NextResponse.json({ error: "Invalid range" }, { status: 400 });
    }
    const data = await getAnalyticsTrends(range);
    return NextResponse.json(data);
  } catch (error) {
    return apiError(error, { fallback: "Failed to load trends" });
  }
}
