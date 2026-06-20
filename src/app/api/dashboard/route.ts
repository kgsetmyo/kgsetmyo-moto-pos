import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { getDashboardStatsSupabase } from "@/lib/data/dashboard";

export async function GET() {
  try {
    await requireProfile();
    const stats = await getDashboardStatsSupabase();
    return NextResponse.json(stats);
  } catch (error) {
    return apiError(error, { fallback: "Failed" });
  }
}
