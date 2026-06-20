"use client";

import Card from "@mui/joy/Card";
import Typography from "@mui/joy/Typography";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface Point {
  date: string;
  revenue: number;
  grossProfit: number;
}

interface RevenueProfitChartProps {
  data: Point[];
  range: "30d" | "12m";
}

export function RevenueProfitChart({ data, range }: RevenueProfitChartProps) {
  const tickFormatter = (value: string) =>
    range === "12m" ? value.slice(0, 7) : value.slice(5);

  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Typography level="title-md" mb={2}>
        Revenue vs gross profit
      </Typography>
      {data.length === 0 ? (
        <Typography level="body-sm" textColor="neutral.500">
          No sales data for this period.
        </Typography>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--joy-palette-neutral-outlinedBorder)" />
            <XAxis dataKey="date" tickFormatter={tickFormatter} fontSize={11} />
            <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} fontSize={11} />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value ?? 0))}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke="var(--joy-palette-primary-500)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="grossProfit"
              name="Gross profit"
              stroke="var(--joy-palette-success-500)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
