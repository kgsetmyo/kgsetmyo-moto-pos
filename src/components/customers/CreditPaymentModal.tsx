"use client";

import { useState } from "react";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import ModalClose from "@mui/joy/ModalClose";
import Typography from "@mui/joy/Typography";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Button from "@mui/joy/Button";
import Select from "@mui/joy/Select";
import Option from "@mui/joy/Option";
import Stack from "@mui/joy/Stack";
import { formatCurrency } from "@/lib/utils";

interface CreditPaymentModalProps {
  open: boolean;
  customer: { id: string; name: string; creditBalance?: number; credit_balance?: number };
  onClose: () => void;
  onPaid: () => void;
}

export function CreditPaymentModal({ open, customer, onClose, onPaid }: CreditPaymentModalProps) {
  const balance = Number(customer.creditBalance ?? customer.credit_balance ?? 0);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"CASH" | "MOBILE_BANKING">("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          amount: parseFloat(amount),
          method,
          reference: reference || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Payment failed");
      setAmount("");
      setReference("");
      setNotes("");
      onPaid();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ minWidth: 360 }}>
        <ModalClose />
        <Typography level="h4">Record Credit Payment</Typography>
        <Typography level="body-sm" mb={2}>
          {customer.name} — Balance: {formatCurrency(balance)}
        </Typography>

        <Stack spacing={2} component="form" onSubmit={handleSubmit}>
          <FormControl required>
            <FormLabel>Amount (MMK)</FormLabel>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              slotProps={{ input: { max: balance, min: 1 } }}
            />
          </FormControl>

          <FormControl>
            <FormLabel>Method</FormLabel>
            <Select value={method} onChange={(_, v) => setMethod(v ?? "CASH")}>
              <Option value="CASH">Cash</Option>
              <Option value="MOBILE_BANKING">Mobile Banking</Option>
            </Select>
          </FormControl>

          <FormControl>
            <FormLabel>Reference</FormLabel>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </FormControl>

          <FormControl>
            <FormLabel>Notes</FormLabel>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormControl>

          {error && <Typography level="body-sm" color="danger">{error}</Typography>}

          <Button type="submit" loading={saving} disabled={balance <= 0}>
            Record Payment
          </Button>
        </Stack>
      </ModalDialog>
    </Modal>
  );
}
