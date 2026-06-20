"use client";

import useSWR from "swr";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import ModalClose from "@mui/joy/ModalClose";
import Typography from "@mui/joy/Typography";
import Table from "@mui/joy/Table";
import Chip from "@mui/joy/Chip";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/Skeletons";

import { jsonFetcher } from "@/lib/api/fetcher";

interface CustomerLedgerModalProps {
  open: boolean;
  customerId: string | null;
  onClose: () => void;
}

export function CustomerLedgerModal({ open, customerId, onClose }: CustomerLedgerModalProps) {
  const { data, isLoading } = useSWR(
    open && customerId ? `/api/customers/${customerId}/ledger` : null,
    jsonFetcher
  );

  const customer = data?.customer;
  const ledger = data?.ledger ?? [];

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ minWidth: 520, maxHeight: "80vh", overflow: "auto" }}>
        <ModalClose />
        <Typography level="h4">Credit Ledger</Typography>
        {customer && (
          <Typography level="body-sm" mb={2}>
            {customer.name} — Current balance:{" "}
            {formatCurrency(Number(customer.credit_balance))}
          </Typography>
        )}

        {isLoading ? (
          <TableSkeleton rows={5} columns={4} />
        ) : (
          <Table size="sm">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((entry: Record<string, unknown>) => (
                <tr key={String(entry.id)}>
                  <td>{formatDateTime(String(entry.created_at))}</td>
                  <td>
                    <Chip size="sm" variant="soft" color={entry.type === "PAYMENT" ? "success" : "warning"}>
                      {String(entry.type)}
                    </Chip>
                  </td>
                  <td>
                    {entry.type === "PAYMENT" ? "-" : "+"}
                    {formatCurrency(Math.abs(Number(entry.amount)))}
                  </td>
                  <td>{formatCurrency(Number(entry.balance_after))}</td>
                </tr>
              ))}
              {ledger.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <Typography level="body-sm" textColor="neutral.500">
                      No ledger entries yet
                    </Typography>
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        )}
      </ModalDialog>
    </Modal>
  );
}
