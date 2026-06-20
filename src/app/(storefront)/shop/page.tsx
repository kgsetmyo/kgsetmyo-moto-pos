"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Input from "@mui/joy/Input";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { jsonFetcher } from "@/lib/api/fetcher";
import { GarageSearch, type GarageFilters } from "@/components/storefront/GarageSearch";
import { ProductGrid } from "@/components/storefront/ProductGrid";
import { CardSkeleton } from "@/components/ui/Skeletons";
import type { StoreProduct } from "@/lib/data/storefront";

export default function ShopPage() {
  const [filters, setFilters] = useState<GarageFilters>({
    bikeBrand: "",
    bikeModel: "",
    year: "",
  });
  const [q, setQ] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: "1", pageSize: "24" });
    if (q.trim()) params.set("q", q.trim());
    if (filters.bikeBrand) params.set("bikeBrand", filters.bikeBrand);
    if (filters.bikeModel) params.set("bikeModel", filters.bikeModel);
    if (filters.year) params.set("year", filters.year);
    return `/api/store/products?${params}`;
  }, [filters, q]);

  const { data, isLoading } = useSWR(query, jsonFetcher);

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography level="h2">Shop motorcycle parts</Typography>
        <Typography level="body-md" textColor="neutral.500">
          Select your bike to see compatible parts. Reserve online, collect in store.
        </Typography>
      </Stack>

      <GarageSearch filters={filters} onChange={setFilters} />

      <Input
        placeholder="Search by name or SKU…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{ maxWidth: 420 }}
      />

      {isLoading ? (
        <CardSkeleton />
      ) : (
        <ProductGrid products={(data?.data as StoreProduct[]) ?? []} />
      )}
    </Stack>
  );
}
