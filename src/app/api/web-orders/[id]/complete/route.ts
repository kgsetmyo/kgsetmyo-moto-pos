import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { updateWebOrderFulfillment } from "@/lib/data/web-orders";

const completeSchema = z.object({
  payments: z
    .array(
      z.object({
        method: z.enum(["CASH", "MOBILE_BANKING"]),
        amount: z.number().positive(),
        reference: z.string().optional(),
      })
    )
    .default([]),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireProfile(["ADMIN", "CASHIER"]);
    const { id } = await context.params;
    const body = completeSchema.parse(await request.json());

    const result = await updateWebOrderFulfillment(
      id,
      profile.id,
      "COMPLETE",
      body.payments
    );
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, { fallback: "Failed to complete order" });
  }
}
