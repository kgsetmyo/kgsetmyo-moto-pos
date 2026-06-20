import { createAdminClient } from "@/lib/supabase/admin";

export async function listCustomers(params: {
  q?: string;
  page: number;
  pageSize: number;
}) {
  const supabase = createAdminClient();
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  let query = supabase
    .from("customers")
    .select("*", { count: "exact" })
    .eq("is_active", true)
    .order("name");

  if (params.q) {
    query = query.or(`name.ilike.%${params.q}%,phone.ilike.%${params.q}%`);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  return {
    data: (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      creditBalance: c.credit_balance,
      credit_balance: c.credit_balance,
      creditLimit: c.credit_limit,
      credit_limit: c.credit_limit,
    })),
    total: count ?? 0,
  };
}

export async function updateCustomer(
  id: string,
  input: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    creditLimit?: number | null;
  }
) {
  const supabase = createAdminClient();
  const updates: Record<string, unknown> = {};

  if (input.name) updates.name = input.name.trim();
  if (input.phone !== undefined) updates.phone = input.phone || null;
  if (input.email !== undefined) updates.email = input.email || null;
  if (input.address !== undefined) updates.address = input.address || null;
  if (input.creditLimit !== undefined) updates.credit_limit = input.creditLimit;

  const { data, error } = await supabase
    .from("customers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createCustomer(input: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  creditLimit?: number;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      name: input.name,
      phone: input.phone,
      email: input.email,
      address: input.address,
      credit_limit: input.creditLimit,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function recordCreditPayment(input: {
  customerId: string;
  amount: number;
  method: "CASH" | "MOBILE_BANKING";
  reference?: string;
  notes?: string;
  recordedById: string;
}) {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("record_credit_payment", {
    p_customer_id: input.customerId,
    p_amount: input.amount,
    p_method: input.method,
    p_reference: input.reference ?? null,
    p_notes: input.notes ?? null,
    p_recorded_by: input.recordedById,
  });

  if (!error) {
    return {
      payment: { id: data.paymentId },
      newBalance: Number(data.newBalance),
    };
  }

  if (!error.message.includes("Could not find the function")) {
    throw new Error(error.message);
  }

  // Fallback when migration 005 not applied yet
  const { data: customer, error: custError } = await supabase
    .from("customers")
    .select("credit_balance")
    .eq("id", input.customerId)
    .single();

  if (custError) throw custError;

  const newBalance = Number(customer.credit_balance) - input.amount;
  if (newBalance < 0) throw new Error("Payment exceeds credit balance");

  const { data: payment, error: payError } = await supabase
    .from("payments")
    .insert({
      customer_id: input.customerId,
      method: input.method,
      amount: input.amount,
      reference: input.reference,
      recorded_by: input.recordedById,
    })
    .select()
    .single();

  if (payError) throw payError;

  const { error: updateError } = await supabase
    .from("customers")
    .update({ credit_balance: newBalance })
    .eq("id", input.customerId);

  if (updateError) throw updateError;

  await supabase.from("credit_ledger_entries").insert({
    customer_id: input.customerId,
    type: "PAYMENT",
    amount: -input.amount,
    balance_after: newBalance,
    payment_id: payment.id,
    notes: input.notes,
    recorded_by: input.recordedById,
  });

  return { payment, newBalance };
}

export async function getCustomerLedger(customerId: string) {
  const supabase = createAdminClient();

  const [customerRes, ledgerRes] = await Promise.all([
    supabase.from("customers").select("*").eq("id", customerId).single(),
    supabase
      .from("credit_ledger_entries")
      .select("id, type, amount, balance_after, notes, created_at, sale_id, payment_id")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (customerRes.error) throw customerRes.error;
  if (ledgerRes.error) throw ledgerRes.error;

  return {
    customer: customerRes.data,
    ledger: ledgerRes.data ?? [],
  };
}

export async function deactivateCustomer(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .update({ is_active: false })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
