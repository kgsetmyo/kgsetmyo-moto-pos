"use client";

import { useState } from "react";
import useSWR from "swr";
import Card from "@mui/joy/Card";
import Box from "@mui/joy/Box";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Button from "@mui/joy/Button";
import Select from "@mui/joy/Select";
import Option from "@mui/joy/Option";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import IconButton from "@mui/joy/IconButton";
import Divider from "@mui/joy/Divider";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { BarcodeLabel } from "@/components/inventory/BarcodeLabel";

import { jsonFetcher } from "@/lib/api/fetcher";

interface CompatRow {
  bikeBrandId: string;
  bikeBrandName: string;
  bikeModelId: string;
  bikeModelName: string;
  years: string;
  useNewBikeBrand: boolean;
  useNewBikeModel: boolean;
}

interface FormState {
  sku: string;
  barcode: string;
  name: string;
  brandId: string;
  brandName: string;
  categoryId: string;
  categoryName: string;
  lowStockThreshold: string;
  compatRows: CompatRow[];
}

interface ProductFormProps {
  productId?: string;
  onSaved?: () => void;
  onCancel?: () => void;
}

function defaultFormState(): FormState {
  return {
    sku: "",
    barcode: "",
    name: "",
    brandId: "",
    brandName: "",
    categoryId: "",
    categoryName: "",
    lowStockThreshold: "5",
    compatRows: [{ bikeBrandId: "", bikeBrandName: "", bikeModelId: "", bikeModelName: "", years: "", useNewBikeBrand: false, useNewBikeModel: false }],
  };
}

function formStateFromExisting(existing: Record<string, unknown>): FormState {
  const compat = (existing.compatibilities ?? []) as Array<{
    year: number;
    bike_model_id: string;
    bike_model: { id: string; bike_brand: { id: string } };
  }>;

  const grouped = new Map<string, CompatRow>();
  for (const c of compat) {
    const key = c.bike_model_id;
    const brandId = c.bike_model?.bike_brand?.id ?? "";
    const row = grouped.get(key) ?? {
      bikeBrandId: brandId,
      bikeBrandName: "",
      bikeModelId: c.bike_model_id,
      bikeModelName: "",
      years: "",
      useNewBikeBrand: false,
      useNewBikeModel: false,
    };
    row.years = row.years ? `${row.years}, ${c.year}` : String(c.year);
    grouped.set(key, row);
  }

  const brand = existing.brand as { id?: string } | undefined;
  const category = existing.category as { id?: string } | undefined;

  return {
    sku: String(existing.sku ?? ""),
    barcode: String(existing.barcode ?? ""),
    name: String(existing.name ?? ""),
    brandId: String(existing.brand_id ?? brand?.id ?? ""),
    brandName: "",
    categoryId: String(existing.category_id ?? category?.id ?? ""),
    categoryName: "",
    lowStockThreshold: String(existing.low_stock_threshold ?? 5),
    compatRows: grouped.size
      ? Array.from(grouped.values())
      : [{ bikeBrandId: "", bikeBrandName: "", bikeModelId: "", bikeModelName: "", years: "", useNewBikeBrand: false, useNewBikeModel: false }],
  };
}

function ProductFormFields({
  productId,
  initial,
  catalog,
  onSaved,
  onCancel,
}: {
  productId?: string;
  initial: FormState;
  catalog: Record<string, unknown> | undefined;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [sku, setSku] = useState(initial.sku);
  const [barcode, setBarcode] = useState(initial.barcode);
  const [name, setName] = useState(initial.name);
  const [brandId, setBrandId] = useState(initial.brandId);
  const [brandName, setBrandName] = useState(initial.brandName);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [categoryName, setCategoryName] = useState(initial.categoryName);
  const [lowStockThreshold, setLowStockThreshold] = useState(initial.lowStockThreshold);
  const [compatRows, setCompatRows] = useState<CompatRow[]>(initial.compatRows);
  const [useNewBrand, setUseNewBrand] = useState(false);
  const [useNewCategory, setUseNewCategory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function parseCompatibilities(rows: CompatRow[]) {
    const result: Array<{ bikeModelId: string; year: number }> = [];
    for (const row of rows) {
      if (!row.bikeModelId || !row.years.trim()) continue;
      const years = row.years
        .split(/[,;\s]+/)
        .map((y) => parseInt(y.trim(), 10))
        .filter((y) => !isNaN(y));
      for (const year of years) {
        result.push({ bikeModelId: row.bikeModelId, year });
      }
    }
    return result;
  }

  async function resolveCompatRows() {
    const resolved: CompatRow[] = [];
    for (const row of compatRows) {
      let bikeBrandId = row.bikeBrandId;
      if (row.useNewBikeBrand && row.bikeBrandName.trim()) {
        const res = await fetch("/api/catalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "bikeBrand", name: row.bikeBrandName.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to add bike brand");
        bikeBrandId = data.id;
      }

      let bikeModelId = row.bikeModelId;
      if (row.useNewBikeModel && row.bikeModelName.trim()) {
        if (!bikeBrandId) throw new Error("Select or add a bike brand before adding a model");
        const res = await fetch("/api/catalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "bikeModel",
            bikeBrandId,
            name: row.bikeModelName.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to add bike model");
        bikeModelId = data.id;
      }

      resolved.push({ ...row, bikeBrandId, bikeModelId });
    }
    return resolved;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const resolvedRows = await resolveCompatRows();
    const payload = {
      sku,
      barcode: barcode || undefined,
      name,
      brandId: useNewBrand ? undefined : brandId || undefined,
      brandName: useNewBrand ? brandName : undefined,
      categoryId: useNewCategory ? undefined : categoryId || undefined,
      categoryName: useNewCategory ? categoryName : undefined,
      lowStockThreshold: parseInt(lowStockThreshold, 10),
      compatibilities: parseCompatibilities(resolvedRows),
    };

    try {
      const url = productId ? `/api/products/${productId}` : "/api/products";
      const method = productId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const modelsForBrand = (brandId: string) =>
    (catalog?.bikeBrands as Array<{ id: string; models?: Array<{ id: string; name: string }> }> | undefined)
      ?.find((b) => b.id === brandId)?.models ?? [];

  return (
    <Card variant="outlined" component="form" onSubmit={handleSubmit}>
      <Typography level="title-md" mb={2}>
        {productId ? "Edit Product" : "Add Product"}
      </Typography>

      <Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <FormControl required sx={{ flex: 1 }}>
            <FormLabel>SKU</FormLabel>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} />
          </FormControl>
          <FormControl sx={{ flex: 1 }}>
            <FormLabel>
              Barcode{" "}
              <Button
                type="button"
                size="sm"
                variant="plain"
                disabled={!sku.trim()}
                onClick={() => setBarcode(sku.trim())}
              >
                use SKU
              </Button>
            </FormLabel>
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} />
            {barcode.trim() && (
              <Box sx={{ mt: 1 }}>
                <BarcodeLabel value={barcode.trim()} productName={name || sku} showPrint />
              </Box>
            )}
          </FormControl>
        </Stack>

        <FormControl required>
          <FormLabel>Product Name</FormLabel>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </FormControl>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <FormControl required sx={{ flex: 1 }}>
            <FormLabel>
              Brand{" "}
              <Button type="button" size="sm" variant="plain" onClick={() => setUseNewBrand((v) => !v)}>
                {useNewBrand ? "pick existing" : "add new"}
              </Button>
            </FormLabel>
            {useNewBrand ? (
              <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="e.g. NGK" />
            ) : (
              <Select value={brandId} onChange={(_, v) => setBrandId(v ?? "")} placeholder="Select brand">
                {(catalog?.brands as Array<{ id: string; name: string }> | undefined)?.map((b) => (
                  <Option key={b.id} value={b.id}>{b.name}</Option>
                ))}
              </Select>
            )}
          </FormControl>

          <FormControl required sx={{ flex: 1 }}>
            <FormLabel>
              Category{" "}
              <Button type="button" size="sm" variant="plain" onClick={() => setUseNewCategory((v) => !v)}>
                {useNewCategory ? "pick existing" : "add new"}
              </Button>
            </FormLabel>
            {useNewCategory ? (
              <Input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="e.g. Spark Plug" />
            ) : (
              <Select value={categoryId} onChange={(_, v) => setCategoryId(v ?? "")} placeholder="Select category">
                {(catalog?.categories as Array<{ id: string; name: string }> | undefined)?.map((c) => (
                  <Option key={c.id} value={c.id}>{c.name}</Option>
                ))}
              </Select>
            )}
          </FormControl>

          <FormControl sx={{ width: 120 }}>
            <FormLabel>Low Stock</FormLabel>
            <Input type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} />
          </FormControl>
        </Stack>

        <Divider />

        <Typography level="title-sm">Bike Compatibility Matrix</Typography>
        <Typography level="body-xs" textColor="neutral.500">
          Add bike brand → model → years (comma-separated, e.g. 2020, 2021, 2022)
        </Typography>

        {compatRows.map((row, i) => (
          <Stack key={i} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="flex-end">
            <FormControl sx={{ flex: 1 }}>
              <FormLabel>
                Bike Brand{" "}
                <Button
                  type="button"
                  size="sm"
                  variant="plain"
                  onClick={() => {
                    const next = [...compatRows];
                    next[i] = {
                      ...row,
                      useNewBikeBrand: !row.useNewBikeBrand,
                      bikeBrandId: "",
                      bikeModelId: "",
                    };
                    setCompatRows(next);
                  }}
                >
                  {row.useNewBikeBrand ? "pick existing" : "add new"}
                </Button>
              </FormLabel>
              {row.useNewBikeBrand ? (
                <Input
                  placeholder="e.g. Honda"
                  value={row.bikeBrandName}
                  onChange={(e) => {
                    const next = [...compatRows];
                    next[i] = { ...row, bikeBrandName: e.target.value, bikeModelId: "" };
                    setCompatRows(next);
                  }}
                />
              ) : (
                <Select
                  value={row.bikeBrandId}
                  onChange={(_, v) => {
                    const next = [...compatRows];
                    next[i] = {
                      ...row,
                      bikeBrandId: v ?? "",
                      bikeModelId: "",
                      bikeModelName: "",
                    };
                    setCompatRows(next);
                  }}
                  placeholder="Honda, Yamaha…"
                >
                  {(catalog?.bikeBrands as Array<{ id: string; name: string }> | undefined)?.map((b) => (
                    <Option key={b.id} value={b.id}>{b.name}</Option>
                  ))}
                </Select>
              )}
            </FormControl>
            <FormControl sx={{ flex: 1 }}>
              <FormLabel>
                Model{" "}
                <Button
                  type="button"
                  size="sm"
                  variant="plain"
                  disabled={!row.bikeBrandId && !row.useNewBikeBrand}
                  onClick={() => {
                    const next = [...compatRows];
                    next[i] = { ...row, useNewBikeModel: !row.useNewBikeModel, bikeModelId: "" };
                    setCompatRows(next);
                  }}
                >
                  {row.useNewBikeModel ? "pick existing" : "add new"}
                </Button>
              </FormLabel>
              {row.useNewBikeModel ? (
                <Input
                  placeholder="e.g. Click"
                  value={row.bikeModelName}
                  disabled={!row.bikeBrandId && !row.bikeBrandName.trim()}
                  onChange={(e) => {
                    const next = [...compatRows];
                    next[i] = { ...row, bikeModelName: e.target.value };
                    setCompatRows(next);
                  }}
                />
              ) : (
                <Select
                  value={row.bikeModelId}
                  onChange={(_, v) => {
                    const next = [...compatRows];
                    next[i] = { ...row, bikeModelId: v ?? "" };
                    setCompatRows(next);
                  }}
                  placeholder="Click, Wave…"
                  disabled={!row.bikeBrandId}
                >
                  {modelsForBrand(row.bikeBrandId).map((m) => (
                    <Option key={m.id} value={m.id}>{m.name}</Option>
                  ))}
                </Select>
              )}
            </FormControl>
            <FormControl sx={{ flex: 1 }}>
              <FormLabel>Years</FormLabel>
              <Input
                placeholder="2020, 2021, 2023"
                value={row.years}
                onChange={(e) => {
                  const next = [...compatRows];
                  next[i] = { ...row, years: e.target.value };
                  setCompatRows(next);
                }}
              />
            </FormControl>
            <IconButton
              color="danger"
              onClick={() => setCompatRows(compatRows.filter((_, j) => j !== i))}
              disabled={compatRows.length === 1}
            >
              <DeleteIcon />
            </IconButton>
          </Stack>
        ))}

        <Button
          type="button"
          size="sm"
          variant="outlined"
          startDecorator={<AddIcon />}
          onClick={() =>
            setCompatRows([
              ...compatRows,
              {
                bikeBrandId: "",
                bikeBrandName: "",
                bikeModelId: "",
                bikeModelName: "",
                years: "",
                useNewBikeBrand: false,
                useNewBikeModel: false,
              },
            ])
          }
        >
          Add compatibility row
        </Button>

        {error && <Typography color="danger" level="body-sm">{error}</Typography>}

        <Stack direction="row" spacing={1}>
          <Button type="submit" loading={saving}>
            {productId ? "Update Product" : "Create Product"}
          </Button>
          {onCancel && (
            <Button variant="outlined" color="neutral" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}

export function ProductForm({ productId, onSaved, onCancel }: ProductFormProps) {
  const { data: catalog } = useSWR("/api/catalog", jsonFetcher);
  const { data: existing, isLoading } = useSWR(
    productId ? `/api/products/${productId}` : null,
    jsonFetcher
  );

  if (productId && isLoading) {
    return (
      <Card variant="outlined">
        <Typography level="body-sm">Loading product…</Typography>
      </Card>
    );
  }

  const initial =
    productId && existing && !existing.error
      ? formStateFromExisting(existing as Record<string, unknown>)
      : defaultFormState();

  const formKey = productId ? `${productId}-${initial.sku}` : "new";

  return (
    <ProductFormFields
      key={formKey}
      productId={productId}
      initial={initial}
      catalog={catalog}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  );
}
