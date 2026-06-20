"use client";

import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Select from "@mui/joy/Select";
import Option from "@mui/joy/Option";
import Stack from "@mui/joy/Stack";
import Button from "@mui/joy/Button";
import useSWR from "swr";
import { jsonFetcher } from "@/lib/api/fetcher";

export interface BikeFilters {
  bikeBrand: string;
  bikeModel: string;
  year: string;
}

interface PosBikeFiltersProps {
  filters: BikeFilters;
  onChange: (filters: BikeFilters) => void;
}

export function PosBikeFilters({ filters, onChange }: PosBikeFiltersProps) {
  const { data: catalog } = useSWR("/api/catalog", jsonFetcher);

  const bikeBrands = (catalog?.bikeBrands as Array<{ id: string; name: string; models?: Array<{ id: string; name: string }> }>) ?? [];
  const selectedBrand = bikeBrands.find((b) => b.name === filters.bikeBrand);
  const models = selectedBrand?.models ?? [];

  function clearFilters() {
    onChange({ bikeBrand: "", bikeModel: "", year: "" });
  }

  const hasFilters = filters.bikeBrand || filters.bikeModel || filters.year;

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" alignItems="flex-end">
      <FormControl sx={{ minWidth: 140 }}>
        <FormLabel>Bike brand</FormLabel>
        <Select
          placeholder="Any"
          value={filters.bikeBrand || null}
          onChange={(_, v) =>
            onChange({ bikeBrand: v ?? "", bikeModel: "", year: filters.year })
          }
        >
          {bikeBrands.map((b) => (
            <Option key={b.id} value={b.name}>
              {b.name}
            </Option>
          ))}
        </Select>
      </FormControl>
      <FormControl sx={{ minWidth: 140 }}>
        <FormLabel>Model</FormLabel>
        <Select
          placeholder="Any"
          value={filters.bikeModel || null}
          onChange={(_, v) => onChange({ ...filters, bikeModel: v ?? "" })}
          disabled={!filters.bikeBrand}
        >
          {models.map((m) => (
            <Option key={m.id} value={m.name}>
              {m.name}
            </Option>
          ))}
        </Select>
      </FormControl>
      <FormControl sx={{ width: 100 }}>
        <FormLabel>Year</FormLabel>
        <Input
          placeholder="e.g. 2020"
          value={filters.year}
          onChange={(e) => onChange({ ...filters, year: e.target.value })}
        />
      </FormControl>
      {hasFilters && (
        <Button size="sm" variant="plain" color="neutral" onClick={clearFilters}>
          Clear filters
        </Button>
      )}
    </Stack>
  );
}
