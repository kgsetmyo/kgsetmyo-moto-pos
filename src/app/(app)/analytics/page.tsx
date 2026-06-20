"use client";

import { useState } from "react";
import useSWR from "swr";
import Alert from "@mui/joy/Alert";
import Button from "@mui/joy/Button";
import ButtonGroup from "@mui/joy/ButtonGroup";
import Card from "@mui/joy/Card";
import Grid from "@mui/joy/Grid";
import Input from "@mui/joy/Input";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import { getBusinessDateString } from "@/lib/business-date";
import { jsonFetcher } from "@/lib/api/fetcher";
import { useProfile } from "@/hooks/useProfile";
import { CardSkeleton } from "@/components/ui/Skeletons";
import { RevenueProfitChart } from "@/components/analytics/RevenueProfitChart";
import { DeadStockTable } from "@/components/analytics/DeadStockTable";
import { CashierMatrix } from "@/components/analytics/CashierMatrix";
import { ReorderAlerts } from "@/components/analytics/ReorderAlerts";

type Range = "30d" | "12m";

export default function AnalyticsPage() {
  const { isAdmin, isLoading: profileLoading } = useProfile();
  const [range, setRange] = useState<Range>("30d");
  const today = getBusinessDateString();
  const monthStart = today.slice(0, 8) + "01";
  const [cashierFrom, setCashierFrom] = useState(monthStart);
  const [cashierTo, setCashierTo] = useState(today);

  const { data: trends, isLoading: trendsLoading, error: trendsError } = useSWR(
    isAdmin ? `/api/analytics/trends?range=${range}` : null,
    jsonFetcher
  );

  const { data: deadStock, isLoading: deadLoading } = useSWR(
    isAdmin ? "/api/analytics/dead-stock" : null,
    jsonFetcher
  );

  const { data: cashiers, isLoading: cashiersLoading } = useSWR(
    isAdmin ? `/api/analytics/cashiers?from=${cashierFrom}&to=${cashierTo}` : null,
    jsonFetcher
  );

  const { data: reorder, isLoading: reorderLoading } = useSWR(
    isAdmin ? "/api/analytics/reorder-alerts" : null,
    jsonFetcher
  );

  if (profileLoading) {
    return (
      <Grid container spacing={2}>
        {[1, 2].map((i) => (
          <Grid key={i} xs={12}>
            <CardSkeleton />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (!isAdmin) {
    return <Alert color="warning">Analytics is available to Admin users only.</Alert>;
  }

  if (trendsError) {
    return <Alert color="danger">Failed to load analytics</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2}>
        <Typography level="h2">Analytics</Typography>
        <ButtonGroup variant="outlined" size="sm">
          <Button variant={range === "30d" ? "solid" : "outlined"} onClick={() => setRange("30d")}>
            30 days
          </Button>
          <Button variant={range === "12m" ? "solid" : "outlined"} onClick={() => setRange("12m")}>
            12 months
          </Button>
        </ButtonGroup>
      </Stack>

      {trends?.source === "live" && (
        <Alert color="warning" size="sm">
          Materialized views not installed — run migration 010_analytics_mv.sql for faster queries.
        </Alert>
      )}

      {trendsLoading ? (
        <CardSkeleton />
      ) : (
        <RevenueProfitChart data={trends?.series ?? []} range={range} />
      )}

      <Grid container spacing={2}>
        <Grid xs={12} lg={6}>
          <DeadStockTable
            items={deadStock?.items ?? []}
            totalTiedCapital={deadStock?.totalTiedCapital ?? 0}
            loading={deadLoading}
          />
        </Grid>
        <Grid xs={12} lg={6}>
          <ReorderAlerts items={reorder?.items ?? []} loading={reorderLoading} />
        </Grid>
      </Grid>

      <Card variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={2} alignItems="flex-end">
          <FormControl size="sm">
            <FormLabel>Cashier period from</FormLabel>
            <Input type="date" value={cashierFrom} onChange={(e) => setCashierFrom(e.target.value)} />
          </FormControl>
          <FormControl size="sm">
            <FormLabel>To</FormLabel>
            <Input type="date" value={cashierTo} onChange={(e) => setCashierTo(e.target.value)} />
          </FormControl>
        </Stack>
        <CashierMatrix cashiers={cashiers?.cashiers ?? []} loading={cashiersLoading} />
      </Card>
    </Stack>
  );
}
