import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { listWebOrders } from "@/lib/data/web-orders";

export async function GET(request: NextRequest) {
  try {
    await requireProfile(["ADMIN", "CASHIER"]);
    const status = request.nextUrl.searchParams.get("status") as
      | "PENDING"
      | "PICKED"
      | "COMPLETED"
      | null;

    const orders = await listWebOrders(status ?? undefined);
    return NextResponse.json({ orders });
  } catch (error) {
    return apiError(error, { fallback: "Failed to load web orders" });
  }
}
