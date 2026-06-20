import { NextRequest, NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { getCustomerLedger } from "@/lib/data/customers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireProfile(["ADMIN", "CASHIER"]);
    const { id } = await params;
    const data = await getCustomerLedger(id);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
