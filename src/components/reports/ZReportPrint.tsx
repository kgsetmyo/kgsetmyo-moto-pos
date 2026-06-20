"use client";

import { useRef } from "react";
import Button from "@mui/joy/Button";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useReactToPrint } from "react-to-print";
import { formatCurrency } from "@/lib/utils";

interface ZReportPrintProps {
  report: Record<string, unknown>;
  businessDate: string;
  shopName?: string;
}

export function ZReportPrint({ report, businessDate, shopName = "Moto POS" }: ZReportPrintProps) {
  const ref = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: ref });

  const rows: Array<[string, number]> = [
    ["Total Sales", Number(report.totalSales)],
    ["Cash", Number(report.cashTotal)],
    ["Mobile Banking", Number(report.mobileTotal)],
    ["Credit", Number(report.creditTotal)],
    ["COGS", Number(report.totalCogs)],
    ["Gross Profit", Number(report.grossProfit)],
    ["Expenses", Number(report.expenseTotal)],
    ["Net Profit", Number(report.netProfit)],
  ];

  return (
    <Stack spacing={1}>
      <Sheet
        ref={ref}
        sx={{ p: 2, fontFamily: "monospace", fontSize: "13px", maxWidth: 400 }}
      >
        <Typography level="title-md" textAlign="center">
          {shopName}
        </Typography>
        <Typography level="body-sm" textAlign="center" mb={1}>
          Z-Report — {businessDate}
        </Typography>
        <hr />
        {rows.map(([label, value]) => (
          <Stack key={label} direction="row" justifyContent="space-between" sx={{ py: 0.25 }}>
            <span>{label}</span>
            <span>{formatCurrency(value)}</span>
          </Stack>
        ))}
        <hr />
        <Stack direction="row" justifyContent="space-between">
          <span>Sales count</span>
          <span>{String(report.saleCount ?? 0)}</span>
        </Stack>
        {Boolean(report.closed) && (
          <Typography level="body-xs" textAlign="center" sx={{ mt: 2 }}>
            DAY CLOSED
          </Typography>
        )}
      </Sheet>
      <Button size="sm" variant="outlined" onClick={() => handlePrint()}>
        Print Z-Report
      </Button>
    </Stack>
  );
}
