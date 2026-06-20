"use client";

import { useState } from "react";
import useSWR from "swr";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Input from "@mui/joy/Input";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Stack from "@mui/joy/Stack";
import Table from "@mui/joy/Table";
import Typography from "@mui/joy/Typography";
import SearchIcon from "@mui/icons-material/Search";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { getBusinessDateString } from "@/lib/business-date";
import { TableSkeleton } from "@/components/ui/Skeletons";
import { Pagination } from "@/components/ui/Pagination";
import { ThermalReceipt } from "@/components/pos/ThermalReceipt";
import { useProfile } from "@/hooks/useProfile";
import { jsonFetcher } from "@/lib/api/fetcher";

export default function SalesPage() {
  const today = getBusinessDateString();
  const { isAdmin } = useProfile();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [receiptSale, setReceiptSale] = useState<Record<string, unknown> | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);

  const query = [
    `page=${page}`,
    search.trim() ? `q=${encodeURIComponent(search.trim())}` : "",
    from ? `from=${from}` : "",
    to ? `to=${to}` : "",
  ]
    .filter(Boolean)
    .join("&");

  const { data, isLoading, mutate } = useSWR(`/api/sales?${query}`, jsonFetcher);

  async function openReceipt(saleId: string) {
    const res = await fetch(`/api/sales/${saleId}`);
    const sale = await res.json();
    if (!res.ok) {
      alert(sale.error ?? "Failed to load sale");
      return;
    }
    setReceiptSale(sale);
  }

  async function voidSale(saleId: string, invoice: string) {
    if (!confirm(`Void sale ${invoice}? Stock will be restored.`)) return;
    setVoidingId(saleId);
    try {
      const res = await fetch(`/api/sales/${saleId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Voided from sales history" }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Void failed");
      setReceiptSale(null);
      void mutate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Void failed");
    } finally {
      setVoidingId(null);
    }
  }

  return (
    <Stack spacing={3}>
      <Typography level="h2">Sales History</Typography>

      <Card variant="outlined">
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={2}>
          <Input
            startDecorator={<SearchIcon />}
            placeholder="Search invoice number…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            sx={{ flex: 1 }}
          />
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </Stack>

        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : (
          <Stack spacing={2}>
            <Table size="sm" stickyHeader>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Cashier</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data?.data?.length ? (
                  data.data.map((sale: Record<string, unknown>) => {
                    const voided = sale.status === "VOIDED";
                    return (
                      <tr key={String(sale.id)}>
                        <td>
                          <Typography level="body-sm" fontWeight="md">
                            {String(sale.invoiceNumber)}
                          </Typography>
                        </td>
                        <td>
                          <Typography level="body-xs">
                            {formatDateTime(String(sale.createdAt))}
                          </Typography>
                        </td>
                        <td>{String(sale.cashierName)}</td>
                        <td>{sale.customerName ? String(sale.customerName) : "—"}</td>
                        <td>
                          <Chip
                            size="sm"
                            variant="soft"
                            color={voided ? "neutral" : "success"}
                          >
                            {String(sale.status)}
                          </Chip>
                        </td>
                        <td>{formatCurrency(Number(sale.total))}</td>
                        <td>
                          <Stack direction="row" spacing={0.5}>
                            <Button size="sm" variant="outlined" onClick={() => void openReceipt(String(sale.id))}>
                              Receipt
                            </Button>
                            {isAdmin && !voided && (
                              <Button
                                size="sm"
                                variant="outlined"
                                color="danger"
                                loading={voidingId === String(sale.id)}
                                onClick={() => void voidSale(String(sale.id), String(sale.invoiceNumber))}
                              >
                                Void
                              </Button>
                            )}
                          </Stack>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7}>
                      <Typography level="body-sm" textColor="neutral.500">
                        No sales found for this period.
                      </Typography>
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
            <Box sx={{ mt: 2 }}>
              <Pagination
                page={data?.page ?? 1}
                totalPages={data?.totalPages ?? 1}
                onPageChange={setPage}
              />
            </Box>
          </Stack>
        )}
      </Card>

      <Modal open={!!receiptSale} onClose={() => setReceiptSale(null)}>
        <ModalDialog sx={{ maxWidth: 400 }}>
          <Typography level="title-md" mb={2}>
            Receipt — {String(receiptSale?.invoiceNumber ?? "")}
          </Typography>
          {receiptSale?.status === "VOIDED" && (
            <Alert color="warning" variant="soft" sx={{ mb: 2 }}>
              This sale has been voided.
            </Alert>
          )}
          {receiptSale && <ThermalReceipt sale={receiptSale} />}
          <Button variant="outlined" color="neutral" onClick={() => setReceiptSale(null)} sx={{ mt: 2 }}>
            Close
          </Button>
        </ModalDialog>
      </Modal>
    </Stack>
  );
}
