"use client";

import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Table from "@mui/joy/Table";
import Typography from "@mui/joy/Typography";
import { TableSkeleton } from "@/components/ui/Skeletons";

export interface ReorderItem {
  sku: string;
  name: string;
  quantityRemaining: number;
  dailyVelocity: number;
  daysUntilStockout: number;
  urgency: "critical" | "warning";
}

interface ReorderAlertsProps {
  items: ReorderItem[];
  loading?: boolean;
}

export function ReorderAlerts({ items, loading }: ReorderAlertsProps) {
  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography level="title-md">Reorder alerts (&lt; 14 days stock)</Typography>
        <Chip size="sm" variant="soft" color={items.length ? "danger" : "success"}>
          {items.length} SKU{items.length === 1 ? "" : "s"}
        </Chip>
      </Stack>
      {loading ? (
        <TableSkeleton rows={4} columns={5} />
      ) : items.length === 0 ? (
        <Typography level="body-sm" textColor="neutral.500">
          No SKUs projected to run out within 14 days at current velocity.
        </Typography>
      ) : (
        <Sheet variant="outlined" sx={{ borderRadius: "sm", overflow: "auto" }}>
          <Table size="sm">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Stock</th>
                <th>Daily velocity</th>
                <th>Days left</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.sku}>
                  <td>{row.sku}</td>
                  <td>{row.name}</td>
                  <td>{row.quantityRemaining}</td>
                  <td>{row.dailyVelocity}/day</td>
                  <td>
                    <Chip size="sm" color={row.urgency === "critical" ? "danger" : "warning"} variant="soft">
                      {row.daysUntilStockout}d
                    </Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Sheet>
      )}
    </Card>
  );
}
