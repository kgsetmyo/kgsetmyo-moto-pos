import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { listCustomers, recordCreditPayment, createCustomer } from "@/lib/data/customers";
import { getPaginationParams, toPaginated } from "@/lib/utils";

const paymentSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(["CASH", "MOBILE_BANKING"]).default("CASH"),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  creditLimit: z.number().positive().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireProfile();
    const { searchParams } = request.nextUrl;
    const { page, pageSize } = getPaginationParams(searchParams);
    const q = searchParams.get("q")?.trim();

    const { data, total } = await listCustomers({ q, page, pageSize });
    return NextResponse.json(toPaginated(data, total, page, pageSize));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfile(["ADMIN", "CASHIER"]);
    const body = await request.json();

    if (body.name && !body.customerId) {
      const customer = await createCustomer(customerSchema.parse(body));
      return NextResponse.json(customer, { status: 201 });
    }

    const payment = paymentSchema.parse(body);
    const result = await recordCreditPayment({
      ...payment,
      recordedById: profile.id,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
