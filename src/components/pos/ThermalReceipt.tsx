"use client";

import { useRef } from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Stack from "@mui/joy/Stack";
import useSWR from "swr";
import { useReactToPrint } from "react-to-print";
import { jsonFetcher } from "@/lib/api/fetcher";
import { ThermalReceiptPrintArea } from "@/components/pos/ThermalReceiptPrintArea";

interface ThermalReceiptProps {
  sale: Record<string, unknown>;
}

export function ThermalReceipt({ sale }: ThermalReceiptProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });
  const { data: settings } = useSWR("/api/settings", jsonFetcher);

  return (
    <Stack spacing={1}>
      <Box ref={printRef}>
        <ThermalReceiptPrintArea sale={sale} settings={settings} />
      </Box>
      <Button size="sm" variant="outlined" onClick={() => handlePrint()}>
        Print 80mm Receipt
      </Button>
    </Stack>
  );
}
