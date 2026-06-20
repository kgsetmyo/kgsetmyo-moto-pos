"use client";

import useSWR from "swr";
import Card from "@mui/joy/Card";
import Grid from "@mui/joy/Grid";
import Typography from "@mui/joy/Typography";
import { formatCurrency } from "@/lib/utils";
import { jsonFetcher } from "@/lib/api/fetcher";

export function InventoryValuationCard() {
  const { data, error } = useSWR("/api/inventory/valuation", jsonFetcher);

  if (error || !data) return null;

  const stats = [
    { label: "Products in stock", value: String(data.productCount) },
    { label: "Total units", value: String(data.totalUnits) },
    { label: "Cost value (FIFO)", value: formatCurrency(Number(data.totalCostValue)) },
    { label: "Retail value", value: formatCurrency(Number(data.totalRetailValue)) },
    { label: "Potential profit", value: formatCurrency(Number(data.potentialProfit)) },
  ];

  return (
    <Card variant="outlined">
      <Typography level="title-md" mb={2}>
        Stock Valuation (FIFO)
      </Typography>
      <Grid container spacing={2}>
        {stats.map((s) => (
          <Grid key={s.label} xs={6} sm={4}>
            <Typography level="body-xs" textColor="neutral.500">
              {s.label}
            </Typography>
            <Typography level="title-md">{s.value}</Typography>
          </Grid>
        ))}
      </Grid>
    </Card>
  );
}
