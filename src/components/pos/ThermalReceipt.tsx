"use client";

import { useRef } from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
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
  const shopName = settings?.businessName ?? "Moto Parts POS";
  const shopPhone = settings?.phone;
  const shopAddress = settings?.address;
  const shopLogo = settings?.logoUrl;

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
        <Typography level="title-sm" textAlign="center">
          {shopName}
        </Typography>
        {shopLogo && (
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
        )}
        {shopPhone && (
          <Typography level="body-xs" textAlign="center">
            {shopPhone}
          </Typography>
        )}
        {shopAddress && (
          <Typography level="body-xs" textAlign="center">
            {shopAddress}
          </Typography>
        )}
        <Typography level="body-xs" textAlign="center">
          {String(sale.invoiceNumber ?? sale.invoice_number ?? "")}
        </Typography>
        <Typography level="body-xs" textAlign="center">
          {formatDateTime(String(sale.createdAt ?? sale.created_at ?? new Date()))}
        </Typography>
        <hr />
        {lineItems.map((item, i) => {
          const product = item.product as Record<string, unknown> | undefined;
          return (
            <Box key={i} fontFamily="monospace">
              <Box>{String(product?.name ?? item.name ?? "Item")}</Box>
              <Box>
                {Number(item.quantity)} x {formatCurrency(Number(item.unitPrice ?? item.unit_price))}{" "}
                = {formatCurrency(Number(item.lineTotal ?? item.line_total))}
              </Box>
            </Box>
          );
        })}
        <hr />
        <Typography level="title-sm" textAlign="right" fontFamily="monospace">
          TOTAL: {formatCurrency(Number(sale.total))}
        </Typography>
        {(sale.payments as Array<Record<string, unknown>> | undefined)?.map((p, i) => (
          <Typography key={i} level="body-xs" fontFamily="monospace">
            {String(p.method).replace("_", " ")}: {formatCurrency(Number(p.amount))}
          </Typography>
        ))}
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
