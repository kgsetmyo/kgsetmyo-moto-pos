"use client";

import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import Alert from "@mui/joy/Alert";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Table from "@mui/joy/Table";
import Typography from "@mui/joy/Typography";
import { jsonFetcher } from "@/lib/api/fetcher";
import { formatCurrency } from "@/lib/utils";
import { useCart } from "@/components/storefront/CartProvider";
import { CardSkeleton } from "@/components/ui/Skeletons";
import type { StoreProductDetail } from "@/lib/data/storefront";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addItem } = useCart();
  const { data: product, isLoading, error } = useSWR<StoreProductDetail>(
    id ? `/api/store/products/${id}` : null,
    jsonFetcher
  );

  if (isLoading) return <CardSkeleton />;
  if (error || !product) return <Alert color="danger">Product not found</Alert>;

  return (
    <Stack spacing={3}>
      <Card variant="outlined" sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Stack spacing={0.5}>
              <Typography level="h3">{product.name}</Typography>
              <Typography level="body-sm" textColor="neutral.500">
                {product.sku} · {product.brandName} · {product.categoryName}
              </Typography>
            </Stack>
            <Chip variant="soft" color={product.inStock ? "success" : "neutral"}>
              {product.inStock ? "Available" : "Out of stock"}
            </Chip>
          </Stack>
          <Typography level="h2">{formatCurrency(product.sellingPrice)}</Typography>
          <Stack direction="row" spacing={1}>
            <Button
              disabled={!product.inStock}
              onClick={() => {
                addItem({
                  productId: product.id,
                  sku: product.sku,
                  name: product.name,
                  unitPrice: product.sellingPrice,
                });
                router.push("/shop/cart");
              }}
            >
              Add to cart
            </Button>
            <Button variant="outlined" onClick={() => router.push("/shop")}>
              Back to shop
            </Button>
          </Stack>
        </Stack>
      </Card>

      {product.compatibilities.length > 0 && (
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography level="title-md" mb={1}>
            Fits these bikes
          </Typography>
          <Table size="sm">
            <thead>
              <tr>
                <th>Brand</th>
                <th>Model</th>
                <th>Year</th>
              </tr>
            </thead>
            <tbody>
              {product.compatibilities.map((c, i) => (
                <tr key={`${c.bikeBrand}-${c.bikeModel}-${c.year}-${i}`}>
                  <td>{c.bikeBrand}</td>
                  <td>{c.bikeModel}</td>
                  <td>{c.year}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </Stack>
  );
}
