import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { updateWebOrderFulfillment } from "@/lib/data/web-orders";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireProfile(["ADMIN", "CASHIER"]);
    const { id } = await context.params;
    const result = await updateWebOrderFulfillment(id, profile.id, "PICK");
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error, { fallback: "Failed to mark order picked" });
  }
}
