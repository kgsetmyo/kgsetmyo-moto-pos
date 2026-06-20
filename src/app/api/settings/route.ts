import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { getShopSettings, updateShopSettings } from "@/lib/data/shop-settings";

const settingsSchema = z.object({
  businessName: z.string().min(1).max(200),
  phone: z.string().max(50).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  logoUrl: z.string().max(500).nullable().optional(),
});

export async function GET() {
  try {
    await requireProfile();
    const settings = await getShopSettings();
    return NextResponse.json(settings);
  } catch (error) {
    return apiError(error, { fallback: "Failed to load settings" });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireProfile(["ADMIN"]);
    const body = settingsSchema.parse(await request.json());
    const settings = await updateShopSettings({
      businessName: body.businessName,
      phone: body.phone ?? null,
      address: body.address ?? null,
      logoUrl: body.logoUrl === "" ? null : (body.logoUrl ?? null),
    });
    return NextResponse.json(settings);
  } catch (error) {
    return apiError(error, { fallback: "Failed to save settings" });
  }
}
