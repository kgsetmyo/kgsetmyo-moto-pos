import { createAdminClient } from "@/lib/supabase/admin";

const PRODUCT_SELECT = `
  id, sku, barcode, name, low_stock_threshold,
  brand:brands(id, name),
  category:categories(id, name),
  inventory_batches(quantity_remaining, selling_price, received_at),
  compatibilities:product_compatibilities(
    year,
    bike_model:bike_models(name, bike_brand:bike_brands(name))
  )
`;

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

function mapProductRows(
  rows: Array<Record<string, unknown>>
) {
  return rows.map((p) => {
    const batches = (p.inventory_batches as Array<{
      quantity_remaining: number;
      selling_price: number;
      received_at: string;
    }>) ?? [];
    batches.sort((a, b) => a.received_at.localeCompare(b.received_at));
    const totalStock = batches.reduce((s, b) => s + b.quantity_remaining, 0);
    const oldest = batches[0];

    return {
      id: p.id,
      sku: p.sku,
      barcode: p.barcode,
      name: p.name,
      brand: p.brand,
      category: p.category,
      total_stock: totalStock,
      selling_price: oldest ? Number(oldest.selling_price) : 0,
      is_low_stock: totalStock < (p.low_stock_threshold as number),
      compatibilities: p.compatibilities,
    };
  });
}

/** Strip chars that break PostgREST `.or()` filter lists; escape ilike wildcards. */
function sanitizeSearchQuery(q: string) {
  const trimmed = q
    .replace(/[,()'";\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return trimmed.replace(/[%_]/g, (c) => `\\${c}`);
}

export async function searchProducts(params: {
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
    .select(PRODUCT_SELECT, { count: "exact" })
    .eq("is_active", true)
    .order("name");

  if (compatIds !== null) {
    query = query.in("id", compatIds);
  }

  if (q) {
    const safe = sanitizeSearchQuery(q);
    if (safe) {
      query = query.or(
        `sku.ilike.%${safe}%,barcode.ilike.%${safe}%,name.ilike.%${safe}%`
      );
    }
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  return {
    data: mapProductRows((data ?? []) as Array<Record<string, unknown>>),
    total: count ?? 0,
  };
}
