import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/route-errors";
import { requireCustomerAccount } from "@/lib/customer-auth";
import { createWebOrderWithFifo } from "@/lib/data/web-orders";
import { storeCheckoutSchema } from "@/lib/schemas/store-checkout";

export async function GET() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: NextRequest) {
  try {
    const customer = await requireCustomerAccount();
    const body = storeCheckoutSchema.parse(await request.json());

    const order = await createWebOrderWithFifo({
      customerId: customer.id,
      lines: body.lines,
      payAtPickup: body.payAtPickup,
      paymentReference: body.paymentReference,
      notes: body.notes,
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return apiError(error, {
      fallback: "Checkout failed",
      statusMap: {
        "Product not found": 404,
        "Price mismatch": 400,
        "Product unavailable": 409,
      },
    });
  }
}
