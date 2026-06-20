"use client";

import { useState } from "react";
import useSWR from "swr";
import Typography from "@mui/joy/Typography";
import Card from "@mui/joy/Card";
import Stack from "@mui/joy/Stack";
import Table from "@mui/joy/Table";
import Input from "@mui/joy/Input";
import Button from "@mui/joy/Button";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import { formatCurrency } from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/Skeletons";
import { Pagination } from "@/components/ui/Pagination";
import { CreditPaymentModal } from "@/components/customers/CreditPaymentModal";
import { CustomerLedgerModal } from "@/components/customers/CustomerLedgerModal";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";

import { jsonFetcher } from "@/lib/api/fetcher";
import { useProfile } from "@/hooks/useProfile";

export default function CustomersPage() {
  const { isAdmin } = useProfile();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [saving, setSaving] = useState(false);
  const [payCustomer, setPayCustomer] = useState<Record<string, unknown> | null>(null);
  const [ledgerId, setLedgerId] = useState<string | null>(null);
  const [editCustomer, setEditCustomer] = useState<Record<string, unknown> | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editLimit, setEditLimit] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const query = search.trim() ? `&q=${encodeURIComponent(search.trim())}` : "";
  const { data, isLoading, mutate } = useSWR(`/api/customers?page=${page}${query}`, jsonFetcher);

  async function addCustomer(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: phone || undefined,
          creditLimit: creditLimit ? parseFloat(creditLimit) : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed");
      }
      setName("");
      setPhone("");
      setCreditLimit("");
      void mutate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(c: Record<string, unknown>) {
    setEditCustomer(c);
    setEditName(String(c.name ?? ""));
    setEditPhone(String(c.phone ?? ""));
    const limit = c.creditLimit ?? c.credit_limit;
    setEditLimit(limit != null ? String(limit) : "");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editCustomer) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/customers/${editCustomer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          phone: editPhone || undefined,
          creditLimit: editLimit ? parseFloat(editLimit) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed");
      }
      setEditCustomer(null);
      void mutate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setEditSaving(false);
    }
  }

  async function deactivateCustomerRow(id: string, customerName: string) {
    if (!confirm(`Deactivate ${customerName}? They will no longer appear in customer lists.`)) return;
    try {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed");
      }
      void mutate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <Stack spacing={2}>
      <Typography level="h2">Customers & Credit (အကြွေး)</Typography>

      <Card variant="outlined">
        <Typography level="title-md" mb={2}>
          Add Customer
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} component="form" onSubmit={addCustomer}>
          <FormControl required sx={{ flex: 2 }}>
            <FormLabel>Name</FormLabel>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </FormControl>
          <FormControl sx={{ flex: 1 }}>
            <FormLabel>Phone</FormLabel>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FormControl>
          <FormControl sx={{ flex: 1 }}>
            <FormLabel>Credit Limit (MMK)</FormLabel>
            <Input
              type="number"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              placeholder="Optional"
            />
          </FormControl>
          <Button type="submit" loading={saving} sx={{ alignSelf: "flex-end" }}>
            Add
          </Button>
        </Stack>
      </Card>

      <Card variant="outlined">
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
          <FormControl sx={{ flex: 1 }}>
            <FormLabel>Search customers</FormLabel>
            <Input
              placeholder="Name or phone…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </FormControl>
        </Stack>
        {isLoading ? (
          <TableSkeleton rows={6} columns={5} />
        ) : (
          <Stack spacing={2}>
            <Table size="sm" stickyHeader>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Credit Balance</th>
                  <th>Limit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.data?.map((c: Record<string, unknown>) => {
                  const balance = Number(c.creditBalance ?? c.credit_balance);
                  return (
                    <tr key={String(c.id)}>
                      <td>{String(c.name)}</td>
                      <td>{String(c.phone ?? "—")}</td>
                      <td>{formatCurrency(balance)}</td>
                      <td>
                        {c.creditLimit || c.credit_limit
                          ? formatCurrency(Number(c.creditLimit ?? c.credit_limit))
                          : "—"}
                      </td>
                      <td>
                        <Stack direction="row" spacing={0.5}>
                          <Button
                            size="sm"
                            variant="soft"
                            disabled={balance <= 0}
                            onClick={() => setPayCustomer(c)}
                          >
                            Pay
                          </Button>
                          <Button
                            size="sm"
                            variant="outlined"
                            onClick={() => openEdit(c)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outlined"
                            onClick={() => setLedgerId(String(c.id))}
                          >
                            Ledger
                          </Button>
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="outlined"
                              color="danger"
                              onClick={() => deactivateCustomerRow(String(c.id), String(c.name))}
                            >
                              Deactivate
                            </Button>
                          )}
                        </Stack>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination
              page={data?.page ?? 1}
              totalPages={data?.totalPages ?? 1}
              onPageChange={setPage}
            />
          </Stack>
        )}
      </Card>

      {payCustomer && (
        <CreditPaymentModal
          open={!!payCustomer}
          customer={payCustomer as { id: string; name: string; credit_balance?: number }}
          onClose={() => setPayCustomer(null)}
          onPaid={() => void mutate()}
        />
      )}

      <CustomerLedgerModal
        open={!!ledgerId}
        customerId={ledgerId}
        onClose={() => setLedgerId(null)}
      />

      <Modal open={!!editCustomer} onClose={() => setEditCustomer(null)}>
        <ModalDialog>
          <Typography level="title-md" mb={2}>
            Edit Customer
          </Typography>
          <Stack spacing={2} component="form" onSubmit={saveEdit}>
            <FormControl required>
              <FormLabel>Name</FormLabel>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel>Phone</FormLabel>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel>Credit Limit (MMK)</FormLabel>
              <Input
                type="number"
                value={editLimit}
                onChange={(e) => setEditLimit(e.target.value)}
                placeholder="Leave empty for no limit"
              />
            </FormControl>
            <Stack direction="row" spacing={1}>
              <Button type="submit" loading={editSaving}>
                Save
              </Button>
              <Button variant="outlined" color="neutral" onClick={() => setEditCustomer(null)}>
                Cancel
              </Button>
            </Stack>
          </Stack>
        </ModalDialog>
      </Modal>
    </Stack>
  );
}
