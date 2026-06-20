import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/api/route-errors";
import { updateCustomer, deactivateCustomer } from "@/lib/data/customers";

const customerUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  creditLimit: z.number().positive().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireProfile(["ADMIN", "CASHIER"]);
    const { id } = await params;
    const body = customerUpdateSchema.parse(await request.json());
    const customer = await updateCustomer(id, body);
    return NextResponse.json(customer);
  } catch (error) {
    return apiError(error, { fallback: "Update failed" });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireProfile(["ADMIN"]);
    const { id } = await params;
    const customer = await deactivateCustomer(id);
    return NextResponse.json(customer);
  } catch (error) {
    return apiError(error, { fallback: "Deactivate failed" });
  }
}
