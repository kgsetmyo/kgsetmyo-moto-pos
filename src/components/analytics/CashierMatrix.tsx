"use client";

import Card from "@mui/joy/Card";
import Sheet from "@mui/joy/Sheet";
import Table from "@mui/joy/Table";
import Typography from "@mui/joy/Typography";
import { formatCurrency } from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/Skeletons";

export interface CashierRow {
  name: string;
  transactionCount: number;
  totalRevenue: number;
  avgCartSize: number;
}

interface CashierMatrixProps {
  cashiers: CashierRow[];
  loading?: boolean;
}

export function CashierMatrix({ cashiers, loading }: CashierMatrixProps) {
  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Typography level="title-md" mb={2}>
        Cashier performance
      </Typography>
      {loading ? (
        <TableSkeleton rows={4} columns={4} />
      ) : cashiers.length === 0 ? (
        <Typography level="body-sm" textColor="neutral.500">
          No completed sales in this period.
        </Typography>
      ) : (
        <Sheet variant="outlined" sx={{ borderRadius: "sm", overflow: "auto" }}>
          <Table size="sm">
            <thead>
              <tr>
                <th>Cashier</th>
                <th>Transactions</th>
                <th>Revenue</th>
                <th>Avg cart</th>
              </tr>
            </thead>
            <tbody>
              {cashiers.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.transactionCount}</td>
                  <td>{formatCurrency(row.totalRevenue)}</td>
                  <td>{formatCurrency(row.avgCartSize)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Sheet>
      )}
    </Card>
  );
}
