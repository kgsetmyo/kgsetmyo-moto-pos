import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthFromCookies } from "@/lib/supabase/session";

export interface CustomerAccount {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export async function getCustomerAccount(): Promise<CustomerAccount | null> {
  const auth = await getAuthFromCookies();
  if (!auth) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("customers")
    .select("id, user_id, name, email, phone")
    .eq("user_id", auth.userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    userId: data.user_id as string,
    name: data.name,
    email: data.email,
    phone: data.phone,
  };
}

export async function requireCustomerAccount() {
  const customer = await getCustomerAccount();
  if (!customer) {
    throw new Error("Unauthorized");
  }
  return customer;
}

export async function linkOrCreateCustomer(params: {
  userId: string;
  email: string;
  fullName: string;
  phone?: string;
}) {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("customers")
    .select("id, user_id, name, email, phone")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (existing) return existing;

  const { data: byEmail } = await admin
    .from("customers")
    .select("id, user_id")
    .eq("email", params.email)
    .maybeSingle();

  if (byEmail) {
    const { data: linked, error } = await admin
      .from("customers")
      .update({ user_id: params.userId, name: params.fullName, phone: params.phone ?? null })
      .eq("id", byEmail.id)
      .select("id, user_id, name, email, phone")
      .single();
    if (error) throw error;
    return linked;
  }

  const { data: created, error } = await admin
    .from("customers")
    .insert({
      user_id: params.userId,
      name: params.fullName,
      email: params.email,
      phone: params.phone ?? null,
    })
    .select("id, user_id, name, email, phone")
    .single();

  if (error) throw error;
  return created;
}
