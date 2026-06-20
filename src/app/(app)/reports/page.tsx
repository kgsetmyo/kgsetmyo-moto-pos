"use client";

import { useState } from "react";
import useSWR from "swr";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Grid from "@mui/joy/Grid";
import Input from "@mui/joy/Input";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Alert from "@mui/joy/Alert";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import { formatCurrency } from "@/lib/utils";
import { getBusinessDateString } from "@/lib/business-date";
import { CardSkeleton } from "@/components/ui/Skeletons";
import { useProfile } from "@/hooks/useProfile";
import DownloadIcon from "@mui/icons-material/Download";
import { ZReportPrint } from "@/components/reports/ZReportPrint";

import { jsonFetcher } from "@/lib/api/fetcher";

export default function ReportsPage() {
  const today = getBusinessDateString();
  const { isAdmin } = useProfile();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [zDate, setZDate] = useState(today);

  const [expCategory, setExpCategory] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expDate, setExpDate] = useState(today);
  const [expDesc, setExpDesc] = useState("");
  const [expSaving, setExpSaving] = useState(false);
  const [closing, setClosing] = useState(false);

  const { data: rangeReport, mutate: refreshRange, isLoading: rangeLoading } = useSWR(
    `/api/reports?from=${from}&to=${to}`,
    jsonFetcher
  );

  const { data: zReport, mutate: refreshZ, isLoading: zLoading } = useSWR(
    `/api/reports?type=z-report&date=${zDate}`,
    jsonFetcher
  );

  const { data: expenses, mutate: refreshExpenses } = useSWR(
    `/api/expenses?from=${from}&to=${to}`,
    jsonFetcher
  );

  const { data: lowStock } = useSWR("/api/inventory/low-stock", jsonFetcher);
  const { data: shopSettings } = useSWR("/api/settings", jsonFetcher);

  const zDayClosed = zReport?.closed === true;
  const todayClosed = zDate === today && zDayClosed;

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    setExpSaving(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: expCategory,
          amount: parseFloat(expAmount),
          expenseDate: expDate,
          description: expDesc || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed");
      }
      setExpCategory("");
      setExpAmount("");
      setExpDesc("");
      void refreshZ();
      void refreshRange();
      void refreshExpenses();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setExpSaving(false);
    }
  }

  async function closeDay() {
    if (
      !confirm(
        `Close business day ${zDate}? This locks new sales and expenses for that day.`
      )
    ) {
      return;
    }
    setClosing(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: zDate }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Close failed");
      void refreshZ();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Close failed");
    } finally {
      setClosing(false);
    }
  }

  return (
    <Stack spacing={3}>
      <Typography level="h2">Reports</Typography>

      {todayClosed && (
        <Alert color="success" variant="soft">
          Today ({today}) is closed. POS sales are blocked until the next business day.
        </Alert>
      )}

      <Card variant="outlined">
        <Typography level="title-md" mb={2}>
          Record Expense
        </Typography>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          component="form"
          onSubmit={addExpense}
        >
          <FormControl required sx={{ flex: 1 }}>
            <FormLabel>Category</FormLabel>
            <Input value={expCategory} onChange={(e) => setExpCategory(e.target.value)} placeholder="Rent, Utilities…" />
          </FormControl>
          <FormControl required sx={{ width: 140 }}>
            <FormLabel>Amount</FormLabel>
            <Input type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} />
          </FormControl>
          <FormControl required sx={{ width: 160 }}>
            <FormLabel>Date</FormLabel>
            <Input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} />
          </FormControl>
          <FormControl sx={{ flex: 1 }}>
            <FormLabel>Description</FormLabel>
            <Input value={expDesc} onChange={(e) => setExpDesc(e.target.value)} />
          </FormControl>
          <Button type="submit" loading={expSaving} sx={{ alignSelf: "flex-end" }}>
            Add
          </Button>
        </Stack>
      </Card>

      <Card variant="outlined">
        <Typography level="title-md" mb={2}>
          Expenses ({from} — {to})
        </Typography>
        {Array.isArray(expenses) && expenses.length > 0 ? (
          <Stack spacing={1}>
            {expenses.map((e: Record<string, unknown>) => (
              <Stack
                key={String(e.id)}
                direction="row"
                justifyContent="space-between"
                sx={{ py: 0.5, borderBottom: "1px solid", borderColor: "divider" }}
              >
                <Box>
                  <Typography level="body-sm" fontWeight="md">
                    {String(e.category)}
                  </Typography>
                  <Typography level="body-xs" textColor="neutral.500">
                    {String(e.expense_date)} {e.description ? `· ${String(e.description)}` : ""}
                  </Typography>
                </Box>
                <Typography level="body-sm">{formatCurrency(Number(e.amount))}</Typography>
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography level="body-sm" textColor="neutral.500">
            No expenses in this date range.
          </Typography>
        )}
      </Card>

      <Card variant="outlined">
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography level="title-md">Daily Close (Z-Report)</Typography>
          {zDayClosed && <Chip color="success" variant="soft">Closed</Chip>}
        </Stack>
        <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
          <Input type="date" value={zDate} onChange={(e) => setZDate(e.target.value)} />
          <Button onClick={() => refreshZ()}>Generate</Button>
          <Button
            component="a"
            href={`/api/reports/export?type=z-report&date=${zDate}`}
            variant="outlined"
            startDecorator={<DownloadIcon />}
          >
            Export CSV
          </Button>
          {isAdmin && !zDayClosed && (
            <Button color="danger" variant="solid" loading={closing} onClick={() => void closeDay()}>
              Close Day
            </Button>
          )}
        </Stack>
        {zLoading ? (
          <CardSkeleton />
        ) : zReport && !zReport.error ? (
          <Grid container spacing={2}>
            {[
              ["Total Sales", zReport.totalSales],
              ["Cash", zReport.cashTotal],
              ["Mobile", zReport.mobileTotal],
              ["Credit", zReport.creditTotal],
              ["COGS", zReport.totalCogs],
              ["Gross Profit", zReport.grossProfit],
              ["Expenses", zReport.expenseTotal],
              ["Net Profit", zReport.netProfit],
            ].map(([label, value]) => (
              <Grid key={String(label)} xs={6} sm={3}>
                <Typography level="body-xs">{label}</Typography>
                <Typography level="title-md">{formatCurrency(Number(value))}</Typography>
              </Grid>
            ))}
          </Grid>
        ) : null}
        {zReport && !zReport.error && !zLoading && (
          <Box sx={{ mt: 2 }}>
            <ZReportPrint
              report={zReport}
              businessDate={zDate}
              shopName={String(shopSettings?.businessName ?? "Moto POS")}
            />
          </Box>
        )}
      </Card>

      <Card variant="outlined">
        <Typography level="title-md" mb={2}>
          Date Range Report
        </Typography>
        <Stack direction="row" spacing={1} mb={2}>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button onClick={() => refreshRange()}>Run</Button>
          <Button
            component="a"
            href={`/api/reports/export?from=${from}&to=${to}`}
            variant="outlined"
            startDecorator={<DownloadIcon />}
          >
            Export CSV
          </Button>
        </Stack>
        {rangeLoading ? (
          <CardSkeleton />
        ) : rangeReport && !rangeReport.error ? (
          <Stack spacing={2}>
            <Grid container spacing={2}>
              {[
                ["Revenue", rangeReport.revenue],
                ["COGS", rangeReport.cogs],
                ["Gross Profit", rangeReport.grossProfit],
                ["Expenses", rangeReport.expenses],
                ["Net Profit", rangeReport.netProfit],
                ["Sales Count", rangeReport.saleCount],
              ].map(([label, value]) => (
                <Grid key={String(label)} xs={6} sm={4}>
                  <Typography level="body-xs">{label}</Typography>
                  <Typography level="title-md">
                    {typeof value === "number" && label !== "Sales Count"
                      ? formatCurrency(value)
                      : String(value)}
                  </Typography>
                </Grid>
              ))}
            </Grid>

            {rangeReport.dailyBreakdown?.length > 0 && (
              <Box>
                <Typography level="title-sm" mb={1}>
                  Daily breakdown
                </Typography>
                <Stack spacing={0.5}>
                  {rangeReport.dailyBreakdown.map((row: { date: string; sales: number; profit: number }) => (
                    <Stack
                      key={row.date}
                      direction="row"
                      justifyContent="space-between"
                      sx={{ py: 0.5, borderBottom: "1px solid", borderColor: "divider" }}
                    >
                      <Typography level="body-sm">{row.date}</Typography>
                      <Typography level="body-sm">
                        Sales {formatCurrency(row.sales)} · Profit {formatCurrency(row.profit)}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        ) : null}
      </Card>

      <Card variant="outlined" id="low-stock">
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography level="title-md">Low Stock Reorder List</Typography>
          <Button
            component="a"
            href="/api/inventory/low-stock/export"
            variant="outlined"
            size="sm"
            startDecorator={<DownloadIcon />}
          >
            Export CSV
          </Button>
        </Stack>
        {lowStock?.data?.length > 0 ? (
          <Stack spacing={1}>
            {lowStock.data.map((item: Record<string, unknown>) => (
              <Stack
                key={String(item.id)}
                direction="row"
                justifyContent="space-between"
                sx={{ py: 0.5, borderBottom: "1px solid", borderColor: "divider" }}
              >
                <Box>
                  <Typography level="body-sm" fontWeight="md">
                    {String(item.name)}
                  </Typography>
                  <Typography level="body-xs" textColor="neutral.500">
                    {String(item.sku)}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="sm" color="danger" variant="soft">
                    {String(item.totalStock)} / {String(item.threshold)}
                  </Chip>
                  {Number(item.shortfall) > 0 && (
                    <Typography level="body-xs" textColor="danger">
                      need +{String(item.shortfall)}
                    </Typography>
                  )}
                </Stack>
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography level="body-sm" textColor="neutral.500">
            All products are above their low-stock thresholds.
          </Typography>
        )}
      </Card>
    </Stack>
  );
}
