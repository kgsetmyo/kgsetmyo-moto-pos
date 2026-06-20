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

    const subtotal = body.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const payments = body.payAtPickup
      ? []
      : [
          {
            method: "MOBILE_BANKING" as const,
            amount: subtotal,
            reference: body.paymentReference,
          },
        ];

    const order = await createWebOrderWithFifo({
      customerId: customer.id,
      lines: body.lines,
      payments,
      notes: body.notes,
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return apiError(error, { fallback: "Checkout failed" });
  }
}
