import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { voidSaleWithFifo } from "@/lib/data/sales";

const voidSchema = z.object({
  reason: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireProfile(["ADMIN"]);
    const { id } = await params;
    const body = voidSchema.parse(await request.json().catch(() => ({})));

    const sale = await voidSaleWithFifo({
      saleId: id,
      voidedById: profile.id,
      reason: body.reason,
    });

    return NextResponse.json(sale);
  } catch (error) {
    return apiError(error, { fallback: "Void failed" });
  }
}
