import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { getInventoryValuation } from "@/lib/data/inventory";

export async function GET() {
  try {
    await requireProfile(["ADMIN"]);
    const valuation = await getInventoryValuation();
    return NextResponse.json(valuation);
  } catch (error) {
    return apiError(error, { fallback: "Failed to load valuation" });
  }
}
