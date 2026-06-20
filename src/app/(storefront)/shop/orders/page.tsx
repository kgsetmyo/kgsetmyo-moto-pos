"use client";

import useSWR from "swr";
import Alert from "@mui/joy/Alert";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Link from "next/link";
import Button from "@mui/joy/Button";
import { jsonFetcher } from "@/lib/api/fetcher";
import { formatCurrency } from "@/lib/utils";
import { CardSkeleton } from "@/components/ui/Skeletons";

const STATUS_COLOR = {
  PENDING: "warning",
  PICKED: "primary",
  COMPLETED: "success",
  CANCELLED: "neutral",
} as const;

export default function OrdersPage() {
  const { data, error, isLoading } = useSWR("/api/store/orders", jsonFetcher);

  if (isLoading) return <CardSkeleton />;
  if (error) {
    return (
      <Stack spacing={2}>
        <Alert color="warning">Sign in to view your orders.</Alert>
        <Button component={Link} href="/shop/account?redirect=/shop/orders">
          Sign in
        </Button>
      </Stack>
    );
  }

  const orders = (data?.orders as Array<Record<string, unknown>>) ?? [];

  return (
    <Stack spacing={3}>
      <Typography level="h3">My orders</Typography>
      {!orders.length ? (
        <Typography level="body-md" textColor="neutral.500">
          No orders yet.{" "}
          <Link href="/shop">Browse the catalog</Link>
        </Typography>
      ) : (
        orders.map((order) => (
          <Card key={order.id as string} variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between">
                <Typography level="title-md">{order.invoice_number as string}</Typography>
                <Chip
                  size="sm"
                  variant="soft"
                  color={STATUS_COLOR[order.fulfillment_status as keyof typeof STATUS_COLOR]}
                >
                  {order.fulfillment_status as string}
                </Chip>
              </Stack>
              <Typography level="body-sm" textColor="neutral.500">
                {new Date(order.created_at as string).toLocaleString()}
              </Typography>
              <Typography level="body-md">{formatCurrency(Number(order.total))}</Typography>
            </Stack>
          </Card>
        ))
      )}
    </Stack>
  );
}
