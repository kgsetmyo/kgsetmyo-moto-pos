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

export function ThermalReceipt({ sale }: ThermalReceiptProps) {
  const ref = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: ref });
  const { data: settings } = useSWR("/api/settings", jsonFetcher);

  const lineItems = (sale.lineItems as Array<Record<string, unknown>>) ?? [];
  const payments = (sale.payments as Array<Record<string, unknown>> | undefined) ?? [];
  const shopName = settings?.businessName ?? "Moto Parts POS";
  const shopPhone = settings?.phone;
  const shopAddress = settings?.address;
  const shopLogo = settings?.logoUrl;
  const mono = { fontFamily: "monospace" };

  return (
    <Stack spacing={1}>
      <Sheet
        ref={ref}
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
          <Typography level="body-xs" textAlign="center" sx={mono}>
            {String(sale.invoiceNumber ?? sale.invoice_number ?? "")}
          </Typography>
          <Typography level="body-xs" textAlign="center" sx={mono}>
            {formatDateTime(String(sale.createdAt ?? sale.created_at ?? new Date()))}
          </Typography>
        </Stack>

        <Divider sx={{ my: 0.5 }} />

        <Stack spacing={0.5}>
          {lineItems.map((item, i) => {
            const product = item.product as Record<string, unknown> | undefined;
            return (
              <Box key={i} sx={mono}>
                <Box>{String(product?.name ?? item.name ?? "Item")}</Box>
                <Box>
                  {Number(item.quantity)} x{" "}
                  {formatCurrency(Number(item.unitPrice ?? item.unit_price))} ={" "}
                  {formatCurrency(Number(item.lineTotal ?? item.line_total))}
                </Box>
              </Box>
            );
          })}
        </Stack>

        <Divider sx={{ my: 0.5 }} />

        <Typography level="title-sm" textAlign="right" sx={mono}>
          TOTAL: {formatCurrency(Number(sale.total))}
        </Typography>

        {payments.length > 0 ? (
          <Stack spacing={0.25}>
            {payments.map((p, i) => (
              <Typography key={i} level="body-xs" sx={mono}>
                {String(p.method).replace("_", " ")}: {formatCurrency(Number(p.amount))}
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
