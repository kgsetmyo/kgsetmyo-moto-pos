"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Grid from "@mui/joy/Grid";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import WarningIcon from "@mui/icons-material/Warning";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { CardSkeleton } from "@/components/ui/Skeletons";
import { useProfile } from "@/hooks/useProfile";
import { MigrationStatusAlert } from "@/components/admin/MigrationStatusAlert";

import { jsonFetcher } from "@/lib/api/fetcher";

export default function DashboardPage() {
  const { data, error, isLoading, mutate } = useSWR("/api/dashboard", jsonFetcher);
  const { isAdmin } = useProfile();
  const [voidingId, setVoidingId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Grid container spacing={2}>
        {[1, 2, 3, 4].map((i) => (
          <Grid key={i} xs={12} sm={6} md={3}>
            <Card><CardSkeleton /></Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  if (error || data?.error) {
    return <Alert color="danger">Failed to load dashboard</Alert>;
  }

  async function voidSale(saleId: string, invoice: string) {
    if (!confirm(`Void sale ${invoice}? Stock will be restored.`)) return;
    setVoidingId(saleId);
    try {
      const res = await fetch(`/api/sales/${saleId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Voided from dashboard" }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Void failed");
      void mutate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Void failed");
    } finally {
      setVoidingId(null);
    }
  }

  const stats = [
    { label: "Today's Sales", value: formatCurrency(data.todaySales) },
    ...(isAdmin
      ? [
          { label: "Today's Profit", value: formatCurrency(data.todayProfit) },
          { label: "Outstanding Credit", value: formatCurrency(data.pendingCredit) },
        ]
      : []),
    { label: "Low Stock Items", value: String(data.lowStockCount), alert: data.lowStockCount > 0 },
  ];

  return (
    <Stack spacing={3}>
      <Typography level="h2">Dashboard</Typography>

      {isAdmin && <MigrationStatusAlert />}

      <Grid container spacing={2}>
        {stats.map((s) => (
          <Grid key={s.label} xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <Typography level="body-sm" textColor="neutral.500">
                {s.label}
              </Typography>
              <Typography level="h3" color={s.alert ? "danger" : undefined}>
                {s.value}
              </Typography>
            </Card>
          </Grid>
        ))}
      </Grid>

      {data.lowStock?.length > 0 && (
        <Card variant="outlined" color="warning">
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <WarningIcon color="warning" />
              <Typography level="title-md">Low Stock Alerts</Typography>
            </Stack>
            {isAdmin && (
              <Button component={Link} href="/reports#low-stock" size="sm" variant="outlined">
                Reorder list
              </Button>
            )}
          </Stack>
          <Stack spacing={1}>
            {data.lowStock.map((item: Record<string, unknown>) => (
              <Stack
                key={String(item.id)}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography level="body-sm">
                  {String(item.name)} ({String(item.sku)})
                </Typography>
                <Chip size="sm" color="danger" variant="soft">
                  {String(item.totalStock)} / {String(item.threshold)}
                </Chip>
              </Stack>
            ))}
          </Stack>
        </Card>
      )}

      {data.recentSales?.length > 0 && (
        <Card variant="outlined">
          <Typography level="title-md" mb={2}>
            Today&apos;s Recent Sales
          </Typography>
          <Stack spacing={1}>
            {data.recentSales.map((sale: Record<string, unknown>) => {
              const voided = sale.status === "VOIDED";
              return (
              <Stack
                key={String(sale.id)}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography level="body-sm" fontWeight="md" sx={{ textDecoration: voided ? "line-through" : undefined }}>
                      {String(sale.invoiceNumber)}
                    </Typography>
                    {voided && (
                      <Chip size="sm" color="neutral" variant="soft">
                        Voided
                      </Chip>
                    )}
                  </Stack>
                  <Typography level="body-xs" textColor="neutral.500">
                    {formatDateTime(String(sale.createdAt))} · {String(sale.cashierName)}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography level="body-sm">{formatCurrency(Number(sale.total))}</Typography>
                  {isAdmin && !voided && (
                    <Button
                      size="sm"
                      variant="outlined"
                      color="danger"
                      loading={voidingId === String(sale.id)}
                      onClick={() => void voidSale(String(sale.id), String(sale.invoiceNumber))}
                    >
                      Void
                    </Button>
                  )}
                </Stack>
              </Stack>
            );
            })}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
