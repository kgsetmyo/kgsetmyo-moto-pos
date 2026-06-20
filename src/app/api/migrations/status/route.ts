import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { getMigrationStatus } from "@/lib/data/migrations";

export async function GET() {
  try {
    await requireProfile(["ADMIN"]);
    const status = await getMigrationStatus();
    return NextResponse.json(status);
  } catch (error) {
    return apiError(error, { fallback: "Failed to check migrations" });
  }
}
