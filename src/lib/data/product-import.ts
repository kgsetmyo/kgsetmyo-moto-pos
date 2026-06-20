import { createAdminClient } from "@/lib/supabase/admin";
import { parseCsv } from "@/lib/csv";
import { upsertBikeBrand, upsertBikeModel } from "@/lib/data/catalog";
import { createProduct } from "@/lib/data/products-admin";

export interface ImportRowResult {
  sku: string;
  status: "created" | "skipped" | "error";
  message?: string;
}

function headerIndex(headers: string[]) {
  const map = new Map<string, number>();
  headers.forEach((h, i) => map.set(h.toLowerCase().trim(), i));
  return map;
}

function cell(row: string[], idx: Map<string, number>, key: string) {
  const i = idx.get(key);
  if (i === undefined) return "";
  return (row[i] ?? "").trim();
}

async function resolveBikeModelId(bikeBrand: string, bikeModel: string) {
  const brand = await upsertBikeBrand(bikeBrand);
  const model = await upsertBikeModel(brand.id, bikeModel);
  return model.id;
}

export async function importProductsFromCsv(csvText: string): Promise<{
  created: number;
  skipped: number;
  errors: number;
  results: ImportRowResult[];
}> {
  const rows = parseCsv(csvText.trim());
  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one data row");
  }

  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const idx = headerIndex(headers);

  for (const required of ["sku", "name", "brand", "category"]) {
    if (!idx.has(required)) {
      throw new Error(`Missing required column: ${required}`);
    }
  }

  const grouped = new Map<
    string,
    {
      sku: string;
      name: string;
      brand: string;
      category: string;
      barcode?: string;
      lowStockThreshold?: number;
      compatibilities: Array<{ bikeBrand: string; bikeModel: string; year: number }>;
    }
  >();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const sku = cell(row, idx, "sku");
    if (!sku) continue;

    const name = cell(row, idx, "name");
    const brand = cell(row, idx, "brand");
    const category = cell(row, idx, "category");
    const barcode = cell(row, idx, "barcode");
    const thresholdRaw = cell(row, idx, "low_stock_threshold");
    const bikeBrand = cell(row, idx, "bike_brand");
    const bikeModel = cell(row, idx, "bike_model");
    const yearRaw = cell(row, idx, "year");

    let entry = grouped.get(sku);
    if (!entry) {
      entry = {
        sku,
        name: name || sku,
        brand,
        category,
        barcode: barcode || undefined,
        lowStockThreshold: thresholdRaw ? parseInt(thresholdRaw, 10) : undefined,
        compatibilities: [],
      };
      grouped.set(sku, entry);
    }

    if (name) entry.name = name;
    if (brand) entry.brand = brand;
    if (category) entry.category = category;
    if (barcode) entry.barcode = barcode;
    if (thresholdRaw) entry.lowStockThreshold = parseInt(thresholdRaw, 10);

    if (bikeBrand && bikeModel && yearRaw) {
      const year = parseInt(yearRaw, 10);
      if (year >= 1980 && year <= 2100) {
        const dup = entry.compatibilities.some(
          (c) => c.bikeBrand === bikeBrand && c.bikeModel === bikeModel && c.year === year
        );
        if (!dup) entry.compatibilities.push({ bikeBrand, bikeModel, year });
      }
    }
  }

  const supabase = createAdminClient();
  const results: ImportRowResult[] = [];
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of grouped.values()) {
    if (!entry.brand || !entry.category) {
      results.push({ sku: entry.sku, status: "error", message: "Brand and category required" });
      errors++;
      continue;
    }

    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("sku", entry.sku)
      .maybeSingle();

    if (existing) {
      results.push({ sku: entry.sku, status: "skipped", message: "SKU already exists" });
      skipped++;
      continue;
    }

    try {
      const compatibilities = [];
      for (const c of entry.compatibilities) {
        const bikeModelId = await resolveBikeModelId(c.bikeBrand, c.bikeModel);
        compatibilities.push({ bikeModelId, year: c.year });
      }

      await createProduct({
        sku: entry.sku,
        name: entry.name,
        brandName: entry.brand,
        categoryName: entry.category,
        barcode: entry.barcode,
        lowStockThreshold: entry.lowStockThreshold,
        compatibilities,
      });

      results.push({ sku: entry.sku, status: "created" });
      created++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      results.push({ sku: entry.sku, status: "error", message });
      errors++;
    }
  }

  return { created, skipped, errors, results };
}
