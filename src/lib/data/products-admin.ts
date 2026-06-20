import { createAdminClient } from "@/lib/supabase/admin";
import { upsertBrand, upsertCategory } from "@/lib/data/catalog";

export interface CompatibilityInput {
  bikeModelId: string;
  year: number;
}

export interface ProductInput {
  sku: string;
  barcode?: string;
  name: string;
  brandId?: string;
  brandName?: string;
  categoryId?: string;
  categoryName?: string;
  lowStockThreshold?: number;
  compatibilities?: CompatibilityInput[];
}

const DETAIL_SELECT = `
  id, sku, barcode, name, low_stock_threshold, is_active, brand_id, category_id,
  brand:brands(id, name),
  category:categories(id, name),
  compatibilities:product_compatibilities(id, year, bike_model_id, bike_model:bike_models(id, name, bike_brand:bike_brands(id, name)))
`;

export async function getProduct(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

async function resolveBrandId(input: ProductInput) {
  if (input.brandId) return input.brandId;
  if (input.brandName) return (await upsertBrand(input.brandName.trim())).id;
  throw new Error("Brand is required");
}

async function resolveCategoryId(input: ProductInput) {
  if (input.categoryId) return input.categoryId;
  if (input.categoryName) return (await upsertCategory(input.categoryName.trim())).id;
  throw new Error("Category is required");
}

async function syncCompatibilities(productId: string, compatibilities: CompatibilityInput[]) {
  const supabase = createAdminClient();
  await supabase.from("product_compatibilities").delete().eq("product_id", productId);

  if (compatibilities.length === 0) return;

  const rows = compatibilities.map((c) => ({
    product_id: productId,
    bike_model_id: c.bikeModelId,
    year: c.year,
  }));

  const { error } = await supabase.from("product_compatibilities").insert(rows);
  if (error) throw error;
}

export async function createProduct(input: ProductInput) {
  const supabase = createAdminClient();
  const brandId = await resolveBrandId(input);
  const categoryId = await resolveCategoryId(input);

  const { data, error } = await supabase
    .from("products")
    .insert({
      sku: input.sku.trim(),
      barcode: input.barcode?.trim() || null,
      name: input.name.trim(),
      brand_id: brandId,
      category_id: categoryId,
      low_stock_threshold: input.lowStockThreshold ?? 5,
    })
    .select()
    .single();

  if (error) throw error;

  if (input.compatibilities?.length) {
    await syncCompatibilities(data.id, input.compatibilities);
  }

  return getProduct(data.id);
}

export async function updateProduct(id: string, input: Partial<ProductInput>) {
  const supabase = createAdminClient();
  const updates: Record<string, unknown> = {};

  if (input.sku) updates.sku = input.sku.trim();
  if (input.barcode !== undefined) updates.barcode = input.barcode?.trim() || null;
  if (input.name) updates.name = input.name.trim();
  if (input.lowStockThreshold !== undefined) updates.low_stock_threshold = input.lowStockThreshold;
  if ((input as { isActive?: boolean }).isActive !== undefined) {
    updates.is_active = (input as { isActive?: boolean }).isActive;
  }
  if (input.brandId || input.brandName) updates.brand_id = await resolveBrandId(input as ProductInput);
  if (input.categoryId || input.categoryName) updates.category_id = await resolveCategoryId(input as ProductInput);

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from("products").update(updates).eq("id", id);
    if (error) throw error;
  }

  if (input.compatibilities) {
    await syncCompatibilities(id, input.compatibilities);
  }

  return getProduct(id);
}

export async function deactivateProduct(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("products").update({ is_active: false }).eq("id", id);
  if (error) throw error;
  return { id, isActive: false };
}
