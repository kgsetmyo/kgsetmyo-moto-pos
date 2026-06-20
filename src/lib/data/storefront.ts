import { createAdminClient } from "@/lib/supabase/admin";

export type StockLabel = "IN_STOCK" | "LOW" | "OUT";

export interface StoreProduct {
  id: string;
  sku: string;
  name: string;
  brandName: string;
  categoryName: string;
  sellingPrice: number;
  stockLabel: StockLabel;
  inStock: boolean;
}

export interface StoreProductDetail extends StoreProduct {
  compatibilities: Array<{
    year: number;
    bikeBrand: string;
    bikeModel: string;
  }>;
}

const PUBLIC_PRODUCT_SELECT = `
  id, sku, name, low_stock_threshold, is_active,
  brand:brands(name),
  category:categories(name),
  inventory_batches(quantity_remaining, selling_price, received_at),
  compatibilities:product_compatibilities(
    year,
    bike_model:bike_models(name, bike_brand:bike_brands(name))
  )
`;

type InventoryBatchRow = {
  quantity_remaining: number;
  selling_price: number;
  received_at: string;
};

function batchStockAndPrice(batches: InventoryBatchRow[]) {
  const sorted = [...batches].sort((a, b) => a.received_at.localeCompare(b.received_at));
  const totalQty = sorted.reduce((sum, batch) => sum + batch.quantity_remaining, 0);
  const sellingPrice = sorted[0] ? Number(sorted[0].selling_price) : 0;
  return { totalQty, sellingPrice };
}

export type StoreCheckoutLineInput = {
  productId: string;
  quantity: number;
  unitPrice?: number;
};

export type StoreCheckoutLineResolved = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

const PRICE_TOLERANCE = 0.01;

/** Resolve authoritative FIFO display prices from DB; reject client tampering. */
export async function resolveStoreCheckoutLines(
  lines: StoreCheckoutLineInput[]
): Promise<StoreCheckoutLineResolved[]> {
  if (lines.length === 0) {
    throw new Error("Order must have at least one line item");
  }

  const productIds = [...new Set(lines.map((line) => line.productId))];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, sku, name, is_active, inventory_batches(quantity_remaining, selling_price, received_at)")
    .in("id", productIds)
    .eq("is_active", true);

  if (error) throw error;

  const byId = new Map(
    (data ?? []).map((row) => [row.id as string, row as Record<string, unknown>])
  );

  const resolved: StoreCheckoutLineResolved[] = [];

  for (const line of lines) {
    const row = byId.get(line.productId);
    if (!row) {
      throw new Error(`Product not found: ${line.productId}`);
    }

    const batches = (row.inventory_batches as InventoryBatchRow[]) ?? [];
    const { totalQty, sellingPrice } = batchStockAndPrice(batches);
    const name = String(row.name ?? row.sku ?? line.productId);

    if (totalQty < line.quantity) {
      throw new Error(`Insufficient stock for ${name}`);
    }
    if (sellingPrice <= 0) {
      throw new Error(`Product unavailable: ${name}`);
    }

    if (
      line.unitPrice !== undefined &&
      Math.abs(line.unitPrice - sellingPrice) > PRICE_TOLERANCE
    ) {
      throw new Error(`Price mismatch for ${name}`);
    }

    resolved.push({
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: sellingPrice,
    });
  }

  return resolved;
}

function sanitizeSearchQuery(q: string) {
  const trimmed = q
    .replace(/[,()'";\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return trimmed.replace(/[%_]/g, (c) => `\\${c}`);
}

function stockLabelFor(totalQty: number, threshold: number): StockLabel {
  if (totalQty <= 0) return "OUT";
  if (totalQty <= threshold) return "LOW";
  return "IN_STOCK";
}

function mapStoreProduct(row: Record<string, unknown>): StoreProduct {
  const batches = (row.inventory_batches as InventoryBatchRow[]) ?? [];
  const { totalQty, sellingPrice } = batchStockAndPrice(batches);
  const brand = row.brand as { name?: string } | null;
  const category = row.category as { name?: string } | null;
  const threshold = Number(row.low_stock_threshold ?? 5);
  const label = stockLabelFor(totalQty, threshold);

  return {
    id: row.id as string,
    sku: row.sku as string,
    name: row.name as string,
    brandName: brand?.name ?? "—",
    categoryName: category?.name ?? "—",
    sellingPrice,
    stockLabel: label,
    inStock: label !== "OUT",
  };
}

function mapStoreProductDetail(row: Record<string, unknown>): StoreProductDetail {
  const base = mapStoreProduct(row);
  const compatRows =
    (row.compatibilities as Array<{
      year: number;
      bike_model: { name?: string; bike_brand?: { name?: string } } | null;
    }>) ?? [];

  return {
    ...base,
    compatibilities: compatRows.map((c) => ({
      year: c.year,
      bikeBrand: c.bike_model?.bike_brand?.name ?? "—",
      bikeModel: c.bike_model?.name ?? "—",
    })),
  };
}

async function productIdsForCompatFilters(params: {
  bikeBrand?: string;
  bikeModel?: string;
  year?: string;
}): Promise<string[] | null> {
  const { bikeBrand, bikeModel, year } = params;
  if (!bikeBrand && !bikeModel && !year) return null;

  const supabase = createAdminClient();
  let query = supabase
    .from("product_compatibilities")
    .select("product_id, year, bike_model:bike_models(name, bike_brand:bike_brands(name))");

  if (year) {
    const y = parseInt(year, 10);
    if (!isNaN(y)) query = query.eq("year", y);
  }

  const { data, error } = await query;
  if (error) throw error;

  const brandNeedle = bikeBrand?.trim().toLowerCase();
  const modelNeedle = bikeModel?.trim().toLowerCase();
  const ids = new Set<string>();

  for (const row of data ?? []) {
    const bikeModelRow = row.bike_model as {
      name?: string;
      bike_brand?: { name?: string };
    } | null;
    const brandName = bikeModelRow?.bike_brand?.name?.toLowerCase() ?? "";
    const modelName = bikeModelRow?.name?.toLowerCase() ?? "";

    if (brandNeedle && !brandName.includes(brandNeedle)) continue;
    if (modelNeedle && !modelName.includes(modelNeedle)) continue;
    ids.add(row.product_id as string);
  }

  return [...ids];
}

export async function searchStoreProducts(params: {
  q?: string;
  bikeBrand?: string;
  bikeModel?: string;
  year?: string;
  page: number;
  pageSize: number;
}) {
  const supabase = createAdminClient();
  const { q, page, pageSize } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const compatIds = await productIdsForCompatFilters(params);
  if (compatIds !== null && compatIds.length === 0) {
    return { data: [], total: 0 };
  }

  let query = supabase
    .from("products")
    .select(PUBLIC_PRODUCT_SELECT, { count: "exact" })
    .eq("is_active", true)
    .order("name");

  if (compatIds !== null) query = query.in("id", compatIds);

  if (q?.trim()) {
    const safe = sanitizeSearchQuery(q);
    if (safe) {
      query = query.or(`name.ilike.%${safe}%,sku.ilike.%${safe}%`);
    }
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  return {
    data: (data ?? []).map((row) => mapStoreProduct(row as Record<string, unknown>)),
    total: count ?? 0,
  };
}

export async function getStoreProductById(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select(PUBLIC_PRODUCT_SELECT)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapStoreProductDetail(data as Record<string, unknown>);
}

export async function getStoreCatalog() {
  const supabase = createAdminClient();
  const [bikeBrands, bikeModels] = await Promise.all([
    supabase.from("bike_brands").select("id, name").order("name"),
    supabase.from("bike_models").select("id, name, bike_brand_id").order("name"),
  ]);

  if (bikeBrands.error) throw bikeBrands.error;
  if (bikeModels.error) throw bikeModels.error;

  const modelsByBrand = new Map<string, Array<{ id: string; name: string }>>();
  for (const m of bikeModels.data ?? []) {
    const list = modelsByBrand.get(m.bike_brand_id) ?? [];
    list.push({ id: m.id, name: m.name });
    modelsByBrand.set(m.bike_brand_id, list);
  }

  return {
    bikeBrands: (bikeBrands.data ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      models: modelsByBrand.get(b.id) ?? [],
    })),
  };
}
