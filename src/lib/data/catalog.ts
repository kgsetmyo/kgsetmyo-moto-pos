import { createAdminClient } from "@/lib/supabase/admin";

export async function getCatalog() {
  const supabase = createAdminClient();

  const [brands, categories, bikeBrands, bikeModels] = await Promise.all([
    supabase.from("brands").select("id, name").order("name"),
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("bike_brands").select("id, name").order("name"),
    supabase
      .from("bike_models")
      .select("id, name, bike_brand_id")
      .order("name"),
  ]);

  if (brands.error) throw brands.error;
  if (categories.error) throw categories.error;
  if (bikeBrands.error) throw bikeBrands.error;
  if (bikeModels.error) throw bikeModels.error;

  const modelsByBrand = new Map<string, Array<{ id: string; name: string }>>();
  for (const m of bikeModels.data ?? []) {
    const list = modelsByBrand.get(m.bike_brand_id) ?? [];
    list.push({ id: m.id, name: m.name });
    modelsByBrand.set(m.bike_brand_id, list);
  }

  return {
    brands: brands.data ?? [],
    categories: categories.data ?? [],
    bikeBrands: (bikeBrands.data ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      models: modelsByBrand.get(b.id) ?? [],
    })),
  };
}

export async function upsertBrand(name: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brands")
    .upsert({ name }, { onConflict: "name" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function upsertCategory(name: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("categories")
    .upsert({ name }, { onConflict: "name" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function upsertBikeBrand(name: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bike_brands")
    .upsert({ name }, { onConflict: "name" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function upsertBikeModel(bikeBrandId: string, name: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bike_models")
    .upsert({ bike_brand_id: bikeBrandId, name }, { onConflict: "bike_brand_id,name" })
    .select()
    .single();
  if (error) throw error;
  return data;
}
