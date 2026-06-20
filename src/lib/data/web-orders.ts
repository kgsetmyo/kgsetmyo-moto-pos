import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentMethod } from "@/types";

export interface WebOrderLineInput {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateWebOrderInput {
  customerId: string;
  lines: WebOrderLineInput[];
  payments: Array<{
    method: PaymentMethod;
    amount: number;
    slipUrl?: string;
    reference?: string;
  }>;
  discount?: number;
  notes?: string;
}

export async function createWebOrderWithFifo(input: CreateWebOrderInput) {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("create_web_order_with_fifo", {
    p_customer_id: input.customerId,
    p_lines: input.lines.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    })),
    p_payments: input.payments.map((p) => ({
      method: p.method,
      amount: p.amount,
      slipUrl: p.slipUrl ?? null,
      reference: p.reference ?? null,
    })),
    p_discount: input.discount ?? 0,
    p_notes: input.notes ?? null,
  });

  if (error) {
    if (error.message.includes("Insufficient stock")) {
      throw new Error(error.message);
    }
    if (error.message.includes("create_web_order_with_fifo")) {
      throw new Error(
        "Web order function not installed. Run migration 011_omnichannel.sql."
      );
    }
    throw error;
  }

  return data;
}

export async function listWebOrders(status?: "PENDING" | "PICKED" | "COMPLETED") {
  const supabase = createAdminClient();
  let query = supabase
    .from("sales")
    .select(
      `id, invoice_number, total, fulfillment_status, created_at, notes,
       customer:customers(name, phone, email),
       sale_line_items(
         quantity, unit_price, line_total,
         product:products(name, sku)
       ),
       payments(method, amount)`
    )
    .eq("source", "WEB")
    .eq("status", "COMPLETED")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("fulfillment_status", status);
  } else {
    query = query.in("fulfillment_status", ["PENDING", "PICKED"]);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const customer = row.customer as { name?: string; phone?: string; email?: string } | null;
    const lineItems = (row.sale_line_items as Array<Record<string, unknown>>) ?? [];
    const payments = (row.payments as Array<{ method: string; amount: number }>) ?? [];
    const paid = payments.reduce((s, p) => s + Number(p.amount), 0);

    return {
      id: row.id,
      invoiceNumber: row.invoice_number,
      total: Number(row.total),
      fulfillmentStatus: row.fulfillment_status,
      createdAt: row.created_at,
      notes: row.notes,
      customerName: customer?.name ?? "Guest",
      customerPhone: customer?.phone ?? null,
      customerEmail: customer?.email ?? null,
      amountPaid: paid,
      amountDue: Number(row.total) - paid,
      lineItems: lineItems.map((li) => {
        const product = li.product as { name?: string; sku?: string } | null;
        return {
          sku: product?.sku ?? "",
          name: product?.name ?? "",
          quantity: li.quantity,
          unitPrice: Number(li.unit_price),
          lineTotal: Number(li.line_total),
        };
      }),
    };
  });
}

export async function updateWebOrderFulfillment(
  saleId: string,
  cashierId: string,
  action: "PICK" | "COMPLETE" | "CANCEL",
  payments: CreateWebOrderInput["payments"] = [],
  reason?: string
) {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("update_web_order_fulfillment", {
    p_sale_id: saleId,
    p_cashier_id: cashierId,
    p_action: action,
    p_payments: payments.map((p) => ({
      method: p.method,
      amount: p.amount,
      slipUrl: p.slipUrl ?? null,
      reference: p.reference ?? null,
    })),
    p_reason: reason ?? null,
  });

  if (error) throw error;
  return data;
}

export async function listCustomerWebOrders(customerId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales")
    .select(
      `id, invoice_number, total, fulfillment_status, created_at,
       sale_line_items(quantity, line_total, product:products(name, sku))`
    )
    .eq("source", "WEB")
    .eq("customer_id", customerId)
    .neq("status", "VOIDED")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
