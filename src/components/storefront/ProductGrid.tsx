"use client";

import Link from "next/link";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Grid from "@mui/joy/Grid";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import type { StoreProduct } from "@/lib/data/storefront";
import { formatCurrency } from "@/lib/utils";
import { useCart } from "@/components/storefront/CartProvider";

const STOCK_COLOR = {
  IN_STOCK: "success",
  LOW: "warning",
  OUT: "neutral",
} as const;

interface ProductGridProps {
  products: StoreProduct[];
}

export function ProductGrid({ products }: ProductGridProps) {
  const { addItem } = useCart();

  if (!products.length) {
    return (
      <Typography level="body-md" textColor="neutral.500">
        No parts match your garage filters. Try another brand or model.
      </Typography>
    );
  }

  return (
    <Grid container spacing={2}>
      {products.map((p) => (
        <Grid key={p.id} xs={12} sm={6} md={4} lg={3}>
          <Card variant="outlined" sx={{ height: "100%", p: 2 }}>
            <Stack spacing={1} sx={{ height: "100%" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Typography level="title-sm">{p.name}</Typography>
                <Chip size="sm" variant="soft" color={STOCK_COLOR[p.stockLabel]}>
                  {p.stockLabel === "IN_STOCK"
                    ? "In stock"
                    : p.stockLabel === "LOW"
                      ? "Low stock"
                      : "Out of stock"}
                </Chip>
              </Stack>
              <Typography level="body-xs" textColor="neutral.500">
                {p.sku} · {p.brandName}
              </Typography>
              <Typography level="title-md">{formatCurrency(p.sellingPrice)}</Typography>
              <Stack direction="row" spacing={1} mt="auto">
                <Button
                  component={Link}
                  href={`/shop/product/${p.id}`}
                  size="sm"
                  variant="outlined"
                  fullWidth
                >
                  Details
                </Button>
                <Button
                  size="sm"
                  disabled={!p.inStock}
                  onClick={() =>
                    addItem({
                      productId: p.id,
                      sku: p.sku,
                      name: p.name,
                      unitPrice: p.sellingPrice,
                    })
                  }
                  fullWidth
                >
                  Add
                </Button>
              </Stack>
            </Stack>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
