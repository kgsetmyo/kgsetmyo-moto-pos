import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { getSaleById } from "@/lib/data/sales";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireProfile(["ADMIN", "CASHIER"]);
    const { id } = await params;
    const sale = await getSaleById(id);
    return NextResponse.json(sale);
  } catch (error) {
    return apiError(error, { fallback: "Sale not found" });
  }
}
