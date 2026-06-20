"use client";

import Button from "@mui/joy/Button";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Select from "@mui/joy/Select";
import Option from "@mui/joy/Option";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import type { PaymentMethod } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { MobileSlipUpload } from "@/components/pos/MobileSlipUpload";
import { CustomerPicker, type SelectedCustomer } from "@/components/pos/CustomerPicker";

export interface PaymentLine {
  id: string;
  method: PaymentMethod;
  amount: string;
  slipUrl?: string;
  reference?: string;
}

interface SplitPaymentPanelProps {
  total: number;
  payments: PaymentLine[];
  onChange: (payments: PaymentLine[]) => void;
  customer: SelectedCustomer | null;
  onCustomerChange: (c: SelectedCustomer | null) => void;
}

function newLine(method: PaymentMethod = "CASH", amount = ""): PaymentLine {
  return { id: crypto.randomUUID(), method, amount };
}

function lineDisplayAmount(line: PaymentLine, payments: PaymentLine[], total: number) {
  if (line.amount) return line.amount;
  if (payments.length === 1 && total > 0) return String(total);
  return "";
}

export function effectivePayments(payments: PaymentLine[], total: number): PaymentLine[] {
  return payments.map((p) => ({
    ...p,
    amount: lineDisplayAmount(p, payments, total),
  }));
}

export function SplitPaymentPanel({
  total,
  payments,
  onChange,
  customer,
  onCustomerChange,
}: SplitPaymentPanelProps) {
  const resolved = effectivePayments(payments, total);
  const paid = resolved.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const remaining = Math.round((total - paid) * 100) / 100;
  const hasCredit = payments.some((p) => p.method === "CREDIT");
  const isBalanced = Math.abs(remaining) < 0.01;

  function updateLine(id: string, patch: Partial<PaymentLine>) {
    onChange(payments.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function addLine() {
    const amt = remaining > 0 ? String(remaining) : "";
    onChange([...payments, newLine("CASH", amt)]);
  }

  function removeLine(id: string) {
    if (payments.length <= 1) return;
    onChange(payments.filter((p) => p.id !== id));
  }

  function fillRemaining(id: string) {
    const others = payments
      .filter((p) => p.id !== id)
      .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const rest = Math.max(0, total - others);
    updateLine(id, { amount: String(rest) });
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography level="title-sm">Payments</Typography>
        <Button type="button" size="sm" variant="outlined" startDecorator={<AddIcon />} onClick={addLine}>
          Split
        </Button>
      </Stack>

      {payments.map((line) => (
        <Stack
          key={line.id}
          spacing={1}
          sx={{ p: 1.5, borderRadius: "sm", bgcolor: "background.level1" }}
        >
          <Stack direction="row" spacing={1} alignItems="flex-end">
            <FormControl sx={{ flex: 1 }}>
              <FormLabel>Method</FormLabel>
              <Select
                value={line.method}
                onChange={(_, v) => updateLine(line.id, { method: v ?? "CASH" })}
              >
                <Option value="CASH">Cash</Option>
                <Option value="MOBILE_BANKING">Mobile</Option>
                <Option value="CREDIT">Credit</Option>
              </Select>
            </FormControl>
            <FormControl sx={{ flex: 1 }}>
              <FormLabel>Amount</FormLabel>
              <Input
                type="number"
                value={lineDisplayAmount(line, payments, total)}
                onChange={(e) => updateLine(line.id, { amount: e.target.value })}
              />
            </FormControl>
            <Button type="button" size="sm" variant="plain" onClick={() => fillRemaining(line.id)}>
              Rest
            </Button>
            <IconButton
              size="sm"
              color="danger"
              disabled={payments.length === 1}
              onClick={() => removeLine(line.id)}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>

          {line.method === "MOBILE_BANKING" && (
            <MobileSlipUpload
              slipUrl={line.slipUrl}
              onUploaded={(url) => updateLine(line.id, { slipUrl: url })}
              onClear={() => updateLine(line.id, { slipUrl: undefined })}
            />
          )}

          {line.method === "MOBILE_BANKING" && (
            <FormControl>
              <FormLabel>Reference</FormLabel>
              <Input
                value={line.reference ?? ""}
                onChange={(e) => updateLine(line.id, { reference: e.target.value })}
                placeholder="Txn ID"
              />
            </FormControl>
          )}
        </Stack>
      ))}

      {hasCredit && (
        <CustomerPicker value={customer} onChange={onCustomerChange} />
      )}

      <Stack direction="row" justifyContent="space-between">
        <Typography level="body-sm" textColor="neutral.500">
          Total: {formatCurrency(total)}
        </Typography>
        <Typography
          level="body-sm"
          color={isBalanced ? "success" : remaining > 0 ? "warning" : "danger"}
          fontWeight="lg"
        >
          {isBalanced ? "Balanced ✓" : `Remaining: ${formatCurrency(remaining)}`}
        </Typography>
      </Stack>
    </Stack>
  );
}

export function validatePayments(
  payments: PaymentLine[],
  total: number,
  customer: SelectedCustomer | null
): string | null {
  const resolved = effectivePayments(payments, total);
  const paid = resolved.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  if (Math.abs(paid - total) > 0.01) {
    return `Payment total (${formatCurrency(paid)}) must equal sale total (${formatCurrency(total)})`;
  }

  for (const p of resolved) {
    const amt = parseFloat(p.amount);
    if (!amt || amt <= 0) return "Each payment must have a positive amount";
    if (p.method === "MOBILE_BANKING" && !p.slipUrl) {
      return "Upload slip for each mobile banking payment";
    }
  }

  if (payments.some((p) => p.method === "CREDIT") && !customer) {
    return "Select a credit customer for credit payments";
  }

  const creditTotal = resolved
    .filter((p) => p.method === "CREDIT")
    .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  if (creditTotal > 0 && customer) {
    const limit = customer.creditLimit ?? customer.credit_limit;
    const balance = customer.creditBalance ?? customer.credit_balance ?? 0;
    if (limit != null && balance + creditTotal > limit) {
      return `Credit limit exceeded (limit ${formatCurrency(Number(limit))}, balance ${formatCurrency(Number(balance))})`;
    }
  }

  return null;
}

export function paymentsToPayload(payments: PaymentLine[], total = 0) {
  return effectivePayments(payments, total).map((p) => ({
    method: p.method,
    amount: parseFloat(p.amount),
    slipUrl: p.slipUrl,
    reference: p.reference,
  }));
}

export function initialPayments(total = 0): PaymentLine[] {
  return [{ id: crypto.randomUUID(), method: "CASH", amount: total > 0 ? String(total) : "" }];
}
