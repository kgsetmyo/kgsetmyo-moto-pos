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

type ReceiptSettings = {
  businessName?: string;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
};

type SaleLineItem = {
  product?: { name?: string };
  name?: string;
  quantity?: number;
  unitPrice?: number;
  unit_price?: number;
  lineTotal?: number;
  line_total?: number;
};

type SalePayment = {
  method?: string;
  amount?: number;
};

interface ThermalReceiptProps {
  sale: Record<string, unknown>;
  settings?: ReceiptSettings;
}

const monoSx = { fontFamily: "monospace" } as const;

function formatPaymentMethod(method: string) {
  return method.replace(/_/g, " ");
}

export function ThermalReceipt({ sale, settings: settingsOverride }: ThermalReceiptProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });
  const shouldFetchSettings = settingsOverride === undefined;
  const { data: fetchedSettings } = useSWR<ReceiptSettings>(
    shouldFetchSettings ? "/api/settings" : null,
    jsonFetcher
  );
  const settings = settingsOverride ?? fetchedSettings;

  const lineItems = (sale.lineItems as SaleLineItem[] | undefined) ?? [];
  const payments = (sale.payments as SalePayment[] | undefined) ?? [];
  const shopName = settings?.businessName ?? "Moto Parts POS";
  const invoiceNumber = String(sale.invoiceNumber ?? sale.invoice_number ?? "");
  const createdAt = formatDateTime(String(sale.createdAt ?? sale.created_at ?? new Date()));
  const totalLabel = formatCurrency(Number(sale.total ?? 0));

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
          {settings?.logoUrl ? (
            <Box
              component="img"
              src={settings.logoUrl}
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
          {settings?.phone ? (
            <Typography level="body-xs" textAlign="center">
              {settings.phone}
            </Typography>
          ) : null}
          {settings?.address ? (
            <Typography level="body-xs" textAlign="center">
              {settings.address}
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
          {lineItems.map((item, index) => {
            const itemName = String(item.product?.name ?? item.name ?? "Item");
            const qty = Number(item.quantity ?? 0);
            const unitPrice = formatCurrency(Number(item.unitPrice ?? item.unit_price ?? 0));
            const lineTotal = formatCurrency(Number(item.lineTotal ?? item.line_total ?? 0));

            return (
              <Box key={index} sx={monoSx}>
                <Box>{itemName}</Box>
                <Box>
                  {qty} x {unitPrice} = {lineTotal}
                </Box>
              </Box>
            );
          })}
        </Stack>

        <Divider sx={{ my: 0.5 }} />

        <Typography level="title-sm" textAlign="right" sx={monoSx}>
          TOTAL: {totalLabel}
        </Typography>

        {payments.length > 0 ? (
          <Stack spacing={0.25} sx={{ mt: 0.25 }}>
            {payments.map((payment, index) => {
              const method = formatPaymentMethod(String(payment.method ?? "payment"));
              const amount = formatCurrency(Number(payment.amount ?? 0));

              return (
                <Typography key={index} level="body-xs" sx={monoSx}>
                  {method}: {amount}
                </Typography>
              );
            })}
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
