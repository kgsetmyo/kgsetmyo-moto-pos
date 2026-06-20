import { createAdminClient } from "@/lib/supabase/admin";

/** Remove stock FIFO-style (oldest batches first) for write-offs/damage. */
export async function adjustStock(input: {
  productId: string;
  quantity: number;
  reason: string;
  recordedById: string;
}) {
  if (input.quantity <= 0) throw new Error("Quantity must be positive");

  const supabase = createAdminClient();

  const { data: batches, error: batchError } = await supabase
    .from("inventory_batches")
    .select("id, quantity_remaining")
    .eq("product_id", input.productId)
    .gt("quantity_remaining", 0)
    .order("received_at", { ascending: true });

  if (batchError) throw batchError;

  let remaining = input.quantity;
  const updates: Array<{ id: string; newQty: number }> = [];

  for (const batch of batches ?? []) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batch.quantity_remaining);
    updates.push({ id: batch.id, newQty: batch.quantity_remaining - take });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error(`Insufficient stock (short by ${remaining} units)`);
  }

  for (const { id, newQty } of updates) {
    const { error } = await supabase
      .from("inventory_batches")
      .update({ quantity_remaining: newQty })
      .eq("id", id);
    if (error) throw error;
  }

  const { error: logError } = await supabase.from("inventory_adjustments").insert({
    product_id: input.productId,
    quantity_removed: input.quantity,
    reason: input.reason.trim(),
    recorded_by: input.recordedById,
  });

  if (logError && !logError.message.includes("inventory_adjustments")) {
    // Table from migration 006 optional — adjustment still applied to batches.
    if (!logError.message.includes("schema cache") && !logError.message.includes("does not exist")) {
      throw logError;
    }
  }

  return { quantityRemoved: input.quantity };
}

/** FIFO inventory valuation at cost and retail selling prices. */
export async function getInventoryValuation() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("inventory_batches")
    .select(
      "quantity_remaining, cost_price, selling_price, product:products(id, sku, name, is_active)"
    )
    .gt("quantity_remaining", 0);

  if (error) throw error;

  let totalUnits = 0;
  let totalCostValue = 0;
  let totalRetailValue = 0;
  const productIds = new Set<string>();

  for (const batch of data ?? []) {
    const productRaw = batch.product as
      | { id: string; is_active?: boolean }
      | Array<{ id: string; is_active?: boolean }>
      | null;
    const product = Array.isArray(productRaw) ? productRaw[0] : productRaw;
    if (!product?.is_active) continue;

    const qty = batch.quantity_remaining as number;
    const cost = Number(batch.cost_price);
    const retail = Number(batch.selling_price);

    totalUnits += qty;
    totalCostValue += qty * cost;
    totalRetailValue += qty * retail;
    productIds.add(product.id);
  }

  return {
    totalUnits,
    totalCostValue,
    totalRetailValue,
    productCount: productIds.size,
    potentialProfit: totalRetailValue - totalCostValue,
  };
}

export async function getLowStockProducts() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("product_stock_view")
    .select("product_id, sku, name, total_stock, low_stock_threshold, is_low_stock")
    .eq("is_low_stock", true)
    .order("total_stock", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((p) => ({
    id: p.product_id as string,
    sku: p.sku,
    name: p.name,
    totalStock: Number(p.total_stock),
    threshold: p.low_stock_threshold as number,
    shortfall: Math.max(0, (p.low_stock_threshold as number) - Number(p.total_stock)),
  }));
}

export async function listBatchesForProduct(productId: string, options?: { includeCosts?: boolean }) {
  const supabase = createAdminClient();
  const includeCosts = options?.includeCosts ?? true;

  const { data, error } = await supabase
    .from("inventory_batches")
    .select(
      includeCosts
        ? "id, batch_number, cost_price, selling_price, quantity_received, quantity_remaining, received_at, notes"
        : "id, batch_number, selling_price, quantity_received, quantity_remaining, received_at, notes"
    )
    .eq("product_id", productId)
    .order("received_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((b) => {
    const row = b as unknown as {
      id: string;
      batch_number: string;
      cost_price?: string | number;
      selling_price: string | number;
      quantity_received: number;
      quantity_remaining: number;
      received_at: string;
      notes: string | null;
    };
    return {
      id: row.id,
      batchNumber: row.batch_number,
      ...(includeCosts ? { costPrice: Number(row.cost_price) } : {}),
      sellingPrice: Number(row.selling_price),
      quantityReceived: row.quantity_received,
      quantityRemaining: row.quantity_remaining,
      receivedAt: row.received_at,
      notes: row.notes,
    };
  });
}

export async function listInventoryAdjustments(params: { page: number; pageSize: number }) {
  const supabase = createAdminClient();
  const offset = (params.page - 1) * params.pageSize;
  const limit = offset + params.pageSize - 1;

  const { data, error, count } = await supabase
    .from("inventory_adjustments")
    .select(
      `id, quantity_removed, reason, created_at,
       product:products(sku, name),
       recorded_by:profiles(full_name)`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, limit);

  if (error) {
    if (error.message.includes("does not exist") || error.message.includes("schema cache")) {
      return { data: [], total: 0, tableMissing: true };
    }
    throw error;
  }

  const rows = (data ?? []).map((row) => {
    const product = row.product as { sku?: string; name?: string } | null;
    const recorder = row.recorded_by as { full_name?: string } | null;
    return {
      id: row.id,
      sku: product?.sku ?? "—",
      productName: product?.name ?? "—",
      quantityRemoved: row.quantity_removed,
      reason: row.reason,
      createdAt: row.created_at,
      recordedBy: recorder?.full_name ?? "—",
    };
  });

  return { data: rows, total: count ?? 0, tableMissing: false };
}
