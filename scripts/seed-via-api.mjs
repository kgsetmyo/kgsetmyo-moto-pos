/**
 * Seed sample data via Supabase REST API (no direct Postgres needed).
 * Usage: SMOKE_INSECURE_TLS=1 node --env-file=.env.local scripts/seed-via-api.mjs
 */
import { createClient } from "@supabase/supabase-js";

if (process.env.SMOKE_INSECURE_TLS === "1" || process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function upsertOne(table, row, onConflict = "name") {
  const { data, error } = await supabase.from(table).upsert(row, { onConflict }).select().single();
  if (error && !error.message.includes("duplicate")) throw error;
  return data;
}

async function seed() {
  console.log("Seeding via Supabase API...\n");

  const ngk = await upsertOne("brands", { name: "NGK" });
  await upsertOne("brands", { name: "Denso" });
  const spark = await upsertOne("categories", { name: "Spark Plug" });
  await upsertOne("categories", { name: "Oil Filter" });
  const honda = await upsertOne("bike_brands", { name: "Honda" });
  await upsertOne("bike_brands", { name: "Yamaha" });

  const { data: click } = await supabase
    .from("bike_models")
    .upsert({ bike_brand_id: honda.id, name: "Click" }, { onConflict: "bike_brand_id,name" })
    .select()
    .single();

  const { data: product, error: productError } = await supabase
    .from("products")
    .upsert(
      {
        sku: "SP-CLICK-001",
        barcode: "8851234567890",
        name: "Spark Plug Click 125",
        brand_id: ngk.id,
        category_id: spark.id,
        low_stock_threshold: 10,
      },
      { onConflict: "sku" }
    )
    .select()
    .single();

  if (productError) throw productError;

  for (const year of [2020, 2021, 2022, 2023]) {
    await supabase.from("product_compatibilities").upsert(
      { product_id: product.id, bike_model_id: click.id, year },
      { onConflict: "product_id,bike_model_id,year" }
    );
  }

  const { data: batches } = await supabase
    .from("inventory_batches")
    .select("quantity_remaining")
    .eq("product_id", product.id);

  const totalStock = (batches ?? []).reduce((sum, b) => sum + b.quantity_remaining, 0);
  const targetStock = 50;

  if (totalStock < targetStock) {
    const add = targetStock - totalStock;
    await supabase.from("inventory_batches").insert({
      product_id: product.id,
      cost_price: 2500,
      selling_price: 4500,
      quantity_received: add,
      quantity_remaining: add,
      notes: "Seed top-up",
    });
    console.log(`   Stock topped up by ${add} units (now ${targetStock})`);
  }

  const { data: existingSettings } = await supabase.from("shop_settings").select("id").limit(1);
  if (!existingSettings?.length) {
    await supabase.from("shop_settings").insert({
      business_name: "Moto Parts Yangon",
      phone: "09-xxx-xxx",
      address: "Yangon, Myanmar",
    });
  }

  console.log("✅ Seed complete");
  console.log(`   Product: ${product.name} (${product.sku})`);
  console.log(`   Stock: 50 units @ 4500 MMK`);
}

seed().catch((e) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});
