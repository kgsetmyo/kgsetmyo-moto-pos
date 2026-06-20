"use client";

import { useRef } from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import useSWR from "swr";
import { useReactToPrint } from "react-to-print";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { jsonFetcher } from "@/lib/api/fetcher";

interface ThermalReceiptProps {
  sale: Record<string, unknown>;
}

type SaleLineItem = Record<string, unknown> & {
  product?: Record<string, unknown>;
  name?: string;
  quantity?: number;
  unitPrice?: number;
  unit_price?: number;
  lineTotal?: number;
  line_total?: number;
};

type SalePayment = Record<string, unknown> & {
  method?: string;
  amount?: number;
};

export function ThermalReceipt({ sale }: ThermalReceiptProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });
  const { data: settings } = useSWR("/api/settings", jsonFetcher);

  const lineItems = (sale.lineItems as SaleLineItem[] | undefined) ?? [];
  const payments = (sale.payments as SalePayment[] | undefined) ?? [];
  const shopName = settings?.businessName ?? "Moto Parts POS";
  const shopPhone = settings?.phone;
  const shopAddress = settings?.address;
  const shopLogo = settings?.logoUrl;
  const monoSx = { fontFamily: "monospace" } as const;

  const invoiceNumber = String(sale.invoiceNumber ?? sale.invoice_number ?? "");
  const createdAt = formatDateTime(String(sale.createdAt ?? sale.created_at ?? new Date()));
  const total = formatCurrency(Number(sale.total ?? 0));

  return (
    <Stack spacing={1}>
      <Sheet
        ref={printRef}
        className="thermal-receipt"
        sx={{
          width: "80mm",
          p: 1,
          fontFamily: "monospace",
          fontSize: "12px",
          bgcolor: "background.surface",
        }}
      >
        <Stack spacing={0.25}>
          <Typography level="title-sm" textAlign="center">
            {shopName}
          </Typography>
          {shopLogo ? (
            <Box
              component="img"
              src={shopLogo}
              alt=""
              sx={{
                display: "block",
                maxWidth: "60mm",
                maxHeight: 40,
                mx: "auto",
                my: 0.5,
              }}
            />
          ) : null}
          {shopPhone ? (
            <Typography level="body-xs" textAlign="center">
              {shopPhone}
            </Typography>
          ) : null}
          {shopAddress ? (
            <Typography level="body-xs" textAlign="center">
              {shopAddress}
            </Typography>
          ) : null}
          <Typography level="body-xs" textAlign="center" sx={monoSx}>
            {invoiceNumber}
          </Typography>
          <Typography level="body-xs" textAlign="center" sx={monoSx}>
            {createdAt}
          </Typography>
        </Stack>

        <Divider sx={{ my: 0.5 }} />

        <Stack spacing={0.5}>
          {lineItems.map((item, index) => (
            <Box key={index} sx={monoSx}>
              <Box>{String(item.product?.name ?? item.name ?? "Item")}</Box>
              <Box>
                {Number(item.quantity ?? 0)} x{" "}
                {formatCurrency(Number(item.unitPrice ?? item.unit_price ?? 0))} ={" "}
                {formatCurrency(Number(item.lineTotal ?? item.line_total ?? 0))}
              </Box>
            </Box>
          ))}
        </Stack>

        <Divider sx={{ my: 0.5 }} />

        <Typography level="title-sm" textAlign="right" sx={monoSx}>
          {`TOTAL: ${total}`}
        </Typography>

        {payments.length > 0 ? (
          <Stack spacing={0.25}>
            {payments.map((payment, index) => (
              <Typography key={index} level="body-xs" sx={monoSx}>
                {String(payment.method ?? "payment").replaceAll("_", " ")}:{" "}
                {formatCurrency(Number(payment.amount ?? 0))}
              </Typography>
            ))}
          </Stack>
        ) : null}

        <Typography level="body-xs" textAlign="center" sx={{ mt: 1 }}>
          ကျေးဇူးတင်ပါသည်
        </Typography>
      </Sheet>

      <Button size="sm" variant="outlined" onClick={() => handlePrint()}>
        Print 80mm Receipt
      </Button>
    </Stack>
  );
}
