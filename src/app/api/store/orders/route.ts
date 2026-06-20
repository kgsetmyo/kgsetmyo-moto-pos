import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/route-errors";
import { requireCustomerAccount } from "@/lib/customer-auth";
import { listCustomerWebOrders } from "@/lib/data/web-orders";

export async function GET() {
  try {
    const customer = await requireCustomerAccount();
    const orders = await listCustomerWebOrders(customer.id);
    return NextResponse.json({ orders });
  } catch (error) {
    return apiError(error, { fallback: "Failed to load orders" });
  }
}
