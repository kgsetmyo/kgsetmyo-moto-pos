"use client";

import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Select from "@mui/joy/Select";
import Option from "@mui/joy/Option";
import Stack from "@mui/joy/Stack";
import Button from "@mui/joy/Button";
import Typography from "@mui/joy/Typography";
import useSWR from "swr";
import { jsonFetcher } from "@/lib/api/fetcher";

export interface GarageFilters {
  bikeBrand: string;
  bikeModel: string;
  year: string;
}

interface GarageSearchProps {
  filters: GarageFilters;
  onChange: (filters: GarageFilters) => void;
}

export function GarageSearch({ filters, onChange }: GarageSearchProps) {
  const { data: catalog } = useSWR("/api/store/catalog", jsonFetcher);
  const bikeBrands =
    (catalog?.bikeBrands as Array<{
      id: string;
      name: string;
      models?: Array<{ id: string; name: string }>;
    }>) ?? [];
  const selectedBrand = bikeBrands.find((b) => b.name === filters.bikeBrand);
  const models = selectedBrand?.models ?? [];

  return (
    <Stack spacing={1.5}>
      <Typography level="title-md">Find parts for your bike</Typography>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} flexWrap="wrap" alignItems="flex-end">
        <FormControl sx={{ minWidth: 160 }}>
          <FormLabel>Bike brand</FormLabel>
          <Select
            placeholder="Select brand"
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
        <FormControl sx={{ minWidth: 160 }}>
          <FormLabel>Model</FormLabel>
          <Select
            placeholder="Select model"
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
        <FormControl sx={{ width: 120 }}>
          <FormLabel>Year</FormLabel>
          <Input
            placeholder="2020"
            value={filters.year}
            onChange={(e) => onChange({ ...filters, year: e.target.value })}
          />
        </FormControl>
        {(filters.bikeBrand || filters.bikeModel || filters.year) && (
          <Button
            size="sm"
            variant="plain"
            onClick={() => onChange({ bikeBrand: "", bikeModel: "", year: "" })}
          >
            Clear garage
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
