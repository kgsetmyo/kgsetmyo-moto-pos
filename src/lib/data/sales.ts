import { createAdminClient } from "@/lib/supabase/admin";
import { getBusinessDateString, yangonDayBounds } from "@/lib/business-date";
import { assertDayOpen } from "@/lib/data/daily-close";
import { toPaginated } from "@/lib/utils";
import type { PaymentMethod } from "@/types";

export interface SaleLineInput {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateSaleInput {
  cashierId: string;
  customerId?: string;
  discount?: number;
  notes?: string;
  lines: SaleLineInput[];
  payments: Array<{
    method: PaymentMethod;
    amount: number;
    slipUrl?: string;
    reference?: string;
  }>;
}

/** Create sale with FIFO via Postgres RPC (works over Supabase REST). */
export async function createSaleWithFifo(input: CreateSaleInput) {
  await assertDayOpen(getBusinessDateString());

  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("create_sale_with_fifo", {
    p_cashier_id: input.cashierId,
    p_customer_id: input.customerId ?? null,
    p_discount: input.discount ?? 0,
    p_notes: input.notes ?? null,
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
  });

  if (error) {
    if (error.message.includes("Insufficient stock")) {
      throw new Error(error.message);
    }
    if (error.message.includes("Credit limit exceeded")) {
      throw new Error(error.message);
    }
    if (error.message.includes("already closed")) {
      throw new Error(error.message);
    }
    if (error.message.includes("create_sale_with_fifo")) {
      throw new Error(
        "Checkout function not installed. Run supabase/migrations/003_create_sale_rpc.sql in Supabase SQL Editor."
      );
    }
    if (
      error.message.includes("invalid input value for enum") &&
      error.message.includes("CREDIT")
    ) {
      throw new Error(
        "Credit sales require migration 008. Run npm run migrate:bundle and paste optional_bundle.sql in Supabase SQL Editor."
      );
    }
    throw error;
  }

  return data;
}

export async function listSales(params: {
  q?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}) {
  const supabase = createAdminClient();
  const offset = (params.page - 1) * params.pageSize;
  const limit = offset + params.pageSize - 1;

  let query = supabase
    .from("sales")
    .select(
      `id, invoice_number, total, status, created_at,
       cashier:profiles(full_name),
       customer:customers(name)`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (params.q?.trim()) {
    query = query.ilike("invoice_number", `%${params.q.trim()}%`);
  }
  if (params.from) {
    query = query.gte("created_at", yangonDayBounds(params.from).start.toISOString());
  }
  if (params.to) {
    query = query.lte("created_at", yangonDayBounds(params.to).end.toISOString());
  }

  const { data, error, count } = await query.range(offset, limit);
  if (error) throw error;

  const rows = (data ?? []).map((s) => {
    const cashier = s.cashier as { full_name?: string } | null;
    const customer = s.customer as { name?: string } | null;
    return {
      id: s.id,
      invoiceNumber: s.invoice_number,
      total: Number(s.total),
      status: s.status,
      createdAt: s.created_at,
      cashierName: cashier?.full_name ?? "—",
      customerName: customer?.name ?? null,
    };
  });

  return toPaginated(rows, count ?? 0, params.page, params.pageSize);
}

export async function getSaleById(id: string) {
  const supabase = createAdminClient();

  const { data: sale, error } = await supabase
    .from("sales")
    .select(
      `id, invoice_number, subtotal, discount, total, status, created_at,
       cashier:profiles(full_name),
       customer:customers(name),
       sale_line_items(
         id, quantity, unit_price, line_total,
         product:products(name, sku)
       ),
       payments(method, amount)`
    )
    .eq("id", id)
    .single();

  if (error) throw error;

  const cashier = sale.cashier as { full_name?: string } | null;
  const customer = sale.customer as { name?: string } | null;
  const lineItems = (sale.sale_line_items as Array<Record<string, unknown>>) ?? [];

  return {
    id: sale.id,
    invoiceNumber: sale.invoice_number,
    invoice_number: sale.invoice_number,
    subtotal: Number(sale.subtotal),
    discount: Number(sale.discount),
    total: Number(sale.total),
    status: sale.status,
    createdAt: sale.created_at,
    created_at: sale.created_at,
    cashierName: cashier?.full_name ?? "—",
    customerName: customer?.name ?? null,
    lineItems: lineItems.map((item) => {
      const product = item.product as { name?: string; sku?: string } | null;
      return {
        id: item.id,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        unit_price: Number(item.unit_price),
        lineTotal: Number(item.line_total),
        line_total: Number(item.line_total),
        product: { name: product?.name, sku: product?.sku },
        name: product?.name,
      };
    }),
    payments: ((sale.payments as Array<{ method: string; amount: number }>) ?? []).map((p) => ({
      method: p.method,
      amount: Number(p.amount),
    })),
  };
}

export async function voidSaleWithFifo(input: {
  saleId: string;
  voidedById: string;
  reason?: string;
}) {
  const supabase = createAdminClient();

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .select("id, status, created_at, invoice_number, total, notes, daily_close_id")
    .eq("id", input.saleId)
    .single();

  if (saleError) throw saleError;
  if (sale.status !== "COMPLETED") {
    throw new Error("Only completed sales can be voided");
  }
  if (sale.daily_close_id) {
    throw new Error("Sale is locked by daily close");
  }

  await assertDayOpen(getBusinessDateString(new Date(sale.created_at)));

  const { data, error } = await supabase.rpc("void_sale_with_fifo", {
    p_sale_id: input.saleId,
    p_voided_by: input.voidedById,
    p_reason: input.reason ?? null,
  });

  if (!error) return data;

  const rpcMissing =
    error.code === "PGRST202" ||
    error.message.includes("Could not find the function") ||
    (error.message.includes("void_sale_with_fifo") && error.message.includes("does not exist"));

  if (!rpcMissing) throw error;

  return voidSaleFallback(supabase, sale, input);
}

async function voidSaleFallback(
  supabase: ReturnType<typeof createAdminClient>,
  sale: {
    id: string;
    invoice_number: string;
    total: number;
    notes: string | null;
  },
  input: { saleId: string; voidedById: string; reason?: string }
) {
  const { data: lineItems, error: lineError } = await supabase
    .from("sale_line_items")
    .select("id")
    .eq("sale_id", input.saleId);

  if (lineError) throw lineError;

  const lineIds = (lineItems ?? []).map((l) => l.id);
  if (lineIds.length > 0) {
    const { data: allocations, error: allocError } = await supabase
      .from("sale_batch_allocations")
      .select("batch_id, quantity")
      .in("sale_line_item_id", lineIds);

    if (allocError) throw allocError;

    for (const alloc of allocations ?? []) {
      const { data: batch, error: batchError } = await supabase
        .from("inventory_batches")
        .select("quantity_remaining")
        .eq("id", alloc.batch_id)
        .single();

      if (batchError) throw batchError;

      const { error: restoreError } = await supabase
        .from("inventory_batches")
        .update({ quantity_remaining: batch.quantity_remaining + alloc.quantity })
        .eq("id", alloc.batch_id);

      if (restoreError) throw restoreError;
    }
  }

  const { data: payments, error: payError } = await supabase
    .from("payments")
    .select("customer_id, amount, method")
    .eq("sale_id", input.saleId);

  if (payError) throw payError;

  for (const payment of payments ?? []) {
    if (payment.method !== "CREDIT" || !payment.customer_id) continue;

    const { data: customer, error: custError } = await supabase
      .from("customers")
      .select("credit_balance")
      .eq("id", payment.customer_id)
      .single();

    if (custError) throw custError;

    const newBalance = Number(customer.credit_balance) - Number(payment.amount);

    const { error: updateCustError } = await supabase
      .from("customers")
      .update({ credit_balance: newBalance })
      .eq("id", payment.customer_id);

    if (updateCustError) throw updateCustError;

    const { error: ledgerError } = await supabase.from("credit_ledger_entries").insert({
      customer_id: payment.customer_id,
      type: "ADJUSTMENT",
      amount: -Number(payment.amount),
      balance_after: newBalance,
      sale_id: input.saleId,
      recorded_by: input.voidedById,
      notes: input.reason?.trim() || "Sale voided",
    });

    if (ledgerError) throw ledgerError;
  }

  const voidNote = input.reason?.trim() ? `VOID: ${input.reason.trim()}` : "VOIDED";
  const newNotes = sale.notes ? `${sale.notes}\n${voidNote}` : voidNote;

  const { error: voidError } = await supabase
    .from("sales")
    .update({ status: "VOIDED", notes: newNotes })
    .eq("id", input.saleId);

  if (voidError) throw voidError;

  return {
    id: sale.id,
    invoiceNumber: sale.invoice_number,
    invoice_number: sale.invoice_number,
    status: "VOIDED",
    total: sale.total,
  };
}

export async function receiveStockBatch(input: {
  productId: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  batchNumber?: string;
  notes?: string;
  createdById?: string;
}) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("inventory_batches")
    .insert({
      product_id: input.productId,
      cost_price: input.costPrice,
      selling_price: input.sellingPrice,
      quantity_received: input.quantity,
      quantity_remaining: input.quantity,
      batch_number: input.batchNumber,
      notes: input.notes,
      created_by: input.createdById,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
