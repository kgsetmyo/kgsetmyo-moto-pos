"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useReactToPrint } from "react-to-print";

interface BarcodeLabelProps {
  value: string;
  productName?: string;
  height?: number;
  showPrint?: boolean;
}

/** Renders a CODE128 barcode SVG for printing or preview. */
export function BarcodeLabel({
  value,
  productName,
  height = 50,
  showPrint = false,
}: BarcodeLabelProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });

  useEffect(() => {
    if (!svgRef.current || !value.trim()) return;
    try {
      JsBarcode(svgRef.current, value.trim(), {
        format: "CODE128",
        width: 1.5,
        height,
        displayValue: true,
        fontSize: 12,
        margin: 4,
      });
    } catch {
      svgRef.current.innerHTML = "";
    }
  }, [value, height]);

  if (!value.trim()) return null;

  return (
    <Stack spacing={1} alignItems="flex-start">
      <Box
        ref={printRef}
        sx={{
          bgcolor: "background.surface",
          p: 2,
          borderRadius: "sm",
          display: "inline-block",
          textAlign: "center",
          minWidth: 180,
        }}
      >
        {productName && (
          <Typography level="body-sm" fontWeight="md" mb={0.5}>
            {productName}
          </Typography>
        )}
        <svg ref={svgRef} />
      </Box>
      {showPrint && (
        <Button size="sm" variant="outlined" onClick={() => handlePrint()}>
          Print Label
        </Button>
      )}
    </Stack>
  );
}
