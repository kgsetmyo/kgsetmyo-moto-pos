import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { listInventoryAdjustments } from "@/lib/data/inventory";
import { getPaginationParams, toPaginated } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    await requireProfile(["ADMIN"]);
    const { page, pageSize } = getPaginationParams(request.nextUrl.searchParams);
    const result = await listInventoryAdjustments({ page, pageSize });
    return NextResponse.json({
      ...toPaginated(result.data, result.total, page, pageSize),
      tableMissing: result.tableMissing,
    });
  } catch (error) {
    return apiError(error, { fallback: "Failed to load adjustments" });
  }
}
