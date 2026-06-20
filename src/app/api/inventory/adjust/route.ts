import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { adjustStock } from "@/lib/data/inventory";

const adjustSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  reason: z.string().min(1).max(500),
});

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile(["ADMIN"]);
    const body = adjustSchema.parse(await request.json());
    const result = await adjustStock({
      ...body,
      recordedById: profile.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiError(error, { fallback: "Adjustment failed" });
  }
}
