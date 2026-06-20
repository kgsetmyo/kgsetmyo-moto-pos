import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { getReorderAlerts } from "@/lib/data/analytics";

export async function GET() {
  try {
    await requireProfile(["ADMIN"]);
    const data = await getReorderAlerts();
    return NextResponse.json(data);
  } catch (error) {
    return apiError(error, { fallback: "Failed to load reorder alerts" });
  }
}
