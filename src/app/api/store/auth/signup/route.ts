import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/api/route-errors";
import { linkOrCreateCustomer } from "@/lib/customer-auth";
import { customerSignupSchema } from "@/lib/schemas/store-checkout";

export async function POST(request: NextRequest) {
  try {
    const body = customerSignupSchema.parse(await request.json());
    const admin = createAdminClient();

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: body.email.trim().toLowerCase(),
      password: body.password,
      email_confirm: true,
      user_metadata: {
        full_name: body.fullName,
        account_type: "customer",
        role: "CUSTOMER",
      },
    });

    if (authError) throw authError;

    const customer = await linkOrCreateCustomer({
      userId: authData.user.id,
      email: body.email.trim().toLowerCase(),
      fullName: body.fullName,
      phone: body.phone,
    });

    return NextResponse.json(
      {
        userId: authData.user.id,
        customerId: customer.id,
        email: body.email,
      },
      { status: 201 }
    );
  } catch (error) {
    return apiError(error, { fallback: "Signup failed" });
  }
}
