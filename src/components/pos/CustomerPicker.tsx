"use client";

import { useState } from "react";
import useSWR from "swr";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import ModalClose from "@mui/joy/ModalClose";
import Input from "@mui/joy/Input";
import Button from "@mui/joy/Button";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import ListItemButton from "@mui/joy/ListItemButton";
import ListItemContent from "@mui/joy/ListItemContent";
import Typography from "@mui/joy/Typography";
import SearchIcon from "@mui/icons-material/Search";
import { formatCurrency } from "@/lib/utils";

import { jsonFetcher } from "@/lib/api/fetcher";

export interface SelectedCustomer {
  id: string;
  name: string;
  credit_balance?: number;
  creditBalance?: number;
  credit_limit?: number | null;
  creditLimit?: number | null;
}

interface CustomerPickerProps {
  value?: SelectedCustomer | null;
  onChange: (customer: SelectedCustomer | null) => void;
}

export function CustomerPicker({ value, onChange }: CustomerPickerProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data, isLoading } = useSWR(
    open ? `/api/customers?q=${encodeURIComponent(q)}&pageSize=20` : null,
    jsonFetcher
  );

  const balance = value?.creditBalance ?? value?.credit_balance ?? 0;
  const limit = value?.creditLimit ?? value?.credit_limit;

  return (
    <>
      <Button
        variant="outlined"
        color={value ? "primary" : "neutral"}
        onClick={() => setOpen(true)}
        fullWidth
      >
        {value
          ? `${value.name} (Credit: ${formatCurrency(Number(balance))}${limit != null ? ` / ${formatCurrency(Number(limit))}` : ""})`
          : "Select credit customer"}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <ModalDialog sx={{ minWidth: 400, maxHeight: "80vh" }}>
          <ModalClose />
          <Typography level="h4">Credit Customer</Typography>
          <Input
            startDecorator={<SearchIcon />}
            placeholder="Search name or phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <List sx={{ overflow: "auto", maxHeight: 320 }}>
            {isLoading && (
              <ListItem>
                <Typography level="body-sm">Loading…</Typography>
              </ListItem>
            )}
            {data?.data?.map((c: Record<string, unknown>) => (
              <ListItem key={String(c.id)}>
                <ListItemButton
                  onClick={() => {
                    onChange({
                      id: String(c.id),
                      name: String(c.name),
                      creditBalance: Number(c.creditBalance ?? c.credit_balance),
                      creditLimit:
                        c.creditLimit != null || c.credit_limit != null
                          ? Number(c.creditLimit ?? c.credit_limit)
                          : null,
                    });
                    setOpen(false);
                  }}
                >
                  <ListItemContent>
                    <Typography level="title-sm">{String(c.name)}</Typography>
                    <Typography level="body-xs">
                      {String(c.phone ?? "—")} · Balance:{" "}
                      {formatCurrency(Number(c.creditBalance ?? c.credit_balance))}
                      {(c.creditLimit ?? c.credit_limit) != null &&
                        ` · Limit: ${formatCurrency(Number(c.creditLimit ?? c.credit_limit))}`}
                    </Typography>
                  </ListItemContent>
                </ListItemButton>
              </ListItem>
            ))}
            {!isLoading && data?.data?.length === 0 && (
              <ListItem>
                <Typography level="body-sm" textColor="neutral.500">
                  No customers found. Add one in Customers page.
                </Typography>
              </ListItem>
            )}
          </List>
          {value && (
            <Button variant="plain" color="danger" onClick={() => onChange(null)}>
              Clear selection
            </Button>
          )}
        </ModalDialog>
      </Modal>
    </>
  );
}
