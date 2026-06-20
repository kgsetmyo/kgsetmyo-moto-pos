import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { getCatalog, upsertBikeBrand, upsertBikeModel } from "@/lib/data/catalog";

const catalogPostSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bikeBrand"), name: z.string().min(1) }),
  z.object({
    type: z.literal("bikeModel"),
    bikeBrandId: z.string().uuid(),
    name: z.string().min(1),
  }),
]);

export async function GET() {
  try {
    await requireProfile();
    const catalog = await getCatalog();
    return NextResponse.json(catalog);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireProfile(["ADMIN"]);
    const body = catalogPostSchema.parse(await request.json());

    if (body.type === "bikeBrand") {
      const brand = await upsertBikeBrand(body.name.trim());
      return NextResponse.json(brand, { status: 201 });
    }

    const model = await upsertBikeModel(body.bikeBrandId, body.name.trim());
    return NextResponse.json(model, { status: 201 });
  } catch (error) {
    return apiError(error, { fallback: "Catalog update failed" });
  }
}
