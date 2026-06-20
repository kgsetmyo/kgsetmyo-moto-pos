"use client";

import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Table from "@mui/joy/Table";
import Typography from "@mui/joy/Typography";
import { formatCurrency } from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/Skeletons";

export interface DeadStockItem {
  sku: string;
  name: string;
  categoryName: string;
  quantityRemaining: number;
  tiedUpCapital: number;
  daysSinceSale: number | null;
}

interface DeadStockTableProps {
  items: DeadStockItem[];
  totalTiedCapital: number;
  loading?: boolean;
}

export function DeadStockTable({ items, totalTiedCapital, loading }: DeadStockTableProps) {
  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography level="title-md">Dead stock (90+ days no sale)</Typography>
        <Chip size="sm" variant="soft" color="warning">
          Capital tied: {formatCurrency(totalTiedCapital)}
        </Chip>
      </Stack>
      {loading ? (
        <TableSkeleton rows={5} columns={5} />
      ) : items.length === 0 ? (
        <Typography level="body-sm" textColor="neutral.500">
          No dead stock — all stocked items sold within 90 days.
        </Typography>
      ) : (
        <Sheet variant="outlined" sx={{ borderRadius: "sm", overflow: "auto" }}>
          <Table size="sm" stickyHeader>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Category</th>
                <th>Qty</th>
                <th>Tied capital</th>
                <th>Days idle</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.sku}>
                  <td>{row.sku}</td>
                  <td>{row.name}</td>
                  <td>{row.categoryName}</td>
                  <td>{row.quantityRemaining}</td>
                  <td>{formatCurrency(row.tiedUpCapital)}</td>
                  <td>{row.daysSinceSale ?? "Never sold"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Sheet>
      )}
    </Card>
  );
}
