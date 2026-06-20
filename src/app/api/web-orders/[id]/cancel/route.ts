import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { updateWebOrderFulfillment } from "@/lib/data/web-orders";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireProfile(["ADMIN", "CASHIER"]);
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { reason?: string };

    const result = await updateWebOrderFulfillment(
      id,
      profile.id,
      "CANCEL",
      [],
      body.reason
    );
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, { fallback: "Failed to cancel order" });
  }
}
