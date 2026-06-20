"use client";

import { useState } from "react";
import useSWR from "swr";
import Card from "@mui/joy/Card";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Button from "@mui/joy/Button";
import Select from "@mui/joy/Select";
import Option from "@mui/joy/Option";
import Stack from "@mui/joy/Stack";
import Table from "@mui/joy/Table";
import Typography from "@mui/joy/Typography";
import Chip from "@mui/joy/Chip";
import Alert from "@mui/joy/Alert";
import { formatCurrency } from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/Skeletons";
import { Pagination } from "@/components/ui/Pagination";
import AddIcon from "@mui/icons-material/Add";
import { BatchHistoryModal } from "@/components/inventory/BatchHistoryModal";

import { jsonFetcher } from "@/lib/api/fetcher";

interface InventoryPanelProps {
  adminMode?: boolean;
  onAddProduct?: () => void;
}

export function InventoryPanel({ adminMode = false, onAddProduct }: InventoryPanelProps) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [adjustMessage, setAdjustMessage] = useState("");
  const [batchProduct, setBatchProduct] = useState<{ id: string; label: string } | null>(null);

  const { data, isLoading, mutate } = useSWR(
    `/api/products?q=${encodeURIComponent(q)}&page=${page}&pageSize=50`,
    jsonFetcher
  );

  const { data: adjData, mutate: mutateAdj } = useSWR(
    adminMode ? "/api/inventory/adjustments?page=1&pageSize=10" : null,
    jsonFetcher
  );

  const products = (data?.data ?? []) as Array<Record<string, unknown>>;
  const hasProducts = products.length > 0;

  async function receiveStock(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProductId) return;
    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch("/api/inventory/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          costPrice: parseFloat(costPrice),
          sellingPrice: parseFloat(sellingPrice),
          quantity: parseInt(quantity, 10),
          batchNumber: batchNumber || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Failed");
      setMessage("Stock received successfully (FIFO batch created)");
      setCostPrice("");
      setSellingPrice("");
      setQuantity("");
      setBatchNumber("");
      void mutate();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function adjustStock(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProductId || !adjustReason.trim()) return;
    setAdjusting(true);
    setAdjustMessage("");
    try {
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          quantity: parseInt(adjustQty, 10),
          reason: adjustReason.trim(),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Failed");
      setAdjustMessage(`Removed ${result.quantityRemoved} units from stock`);
      setAdjustQty("");
      setAdjustReason("");
      void mutate();
      void mutateAdj();
    } catch (err) {
      setAdjustMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setAdjusting(false);
    }
  }

  return (
    <Stack spacing={2}>
      {adminMode && (
        <Card id="receive-stock" variant="outlined" sx={{ borderColor: "primary.300" }}>
          <Typography level="title-md" mb={1}>
            Receive Stock (add quantity to database)
          </Typography>
          <Typography level="body-sm" textColor="neutral.500" mb={2}>
            Creates a FIFO inventory batch — cost price, selling price, and quantity.
          </Typography>

          {!hasProducts && !isLoading && (
            <Alert color="warning" variant="soft" sx={{ mb: 2 }}>
              No products yet. Add a product first, then return here to receive stock.
              {onAddProduct && (
                <Button size="sm" sx={{ mt: 1 }} startDecorator={<AddIcon />} onClick={onAddProduct}>
                  Go to Add Product
                </Button>
              )}
            </Alert>
          )}

          <Stack spacing={2} component="form" onSubmit={receiveStock}>
            <FormControl required>
              <FormLabel>Product</FormLabel>
              <Select
                placeholder={hasProducts ? "Select product" : "Add a product first"}
                value={selectedProductId}
                onChange={(_, v) => setSelectedProductId(v ?? "")}
                disabled={!hasProducts}
              >
                {products.map((p) => (
                  <Option key={String(p.id)} value={String(p.id)}>
                    {String(p.sku)} — {String(p.name)} (Stock: {String(p.total_stock)})
                  </Option>
                ))}
              </Select>
            </FormControl>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl required sx={{ flex: 1 }}>
                <FormLabel>Cost Price (MMK)</FormLabel>
                <Input
                  type="number"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  disabled={!hasProducts}
                />
              </FormControl>
              <FormControl required sx={{ flex: 1 }}>
                <FormLabel>Selling Price (MMK)</FormLabel>
                <Input
                  type="number"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  disabled={!hasProducts}
                />
              </FormControl>
              <FormControl required sx={{ flex: 1 }}>
                <FormLabel>Quantity</FormLabel>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={!hasProducts}
                />
              </FormControl>
            </Stack>
            <FormControl>
              <FormLabel>Batch # (optional)</FormLabel>
              <Input
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                disabled={!hasProducts}
              />
            </FormControl>
            <Button type="submit" loading={submitting} disabled={!hasProducts || !selectedProductId}>
              Receive Stock
            </Button>
            {message && (
              <Typography level="body-sm" color={message.includes("success") ? "success" : "danger"}>
                {message}
              </Typography>
            )}
          </Stack>
        </Card>
      )}

      {adminMode && (
        <Card variant="outlined">
          <Typography level="title-md" mb={1}>
            Stock Adjustment (write-off / damage)
          </Typography>
          <Typography level="body-sm" textColor="neutral.500" mb={2}>
            Removes quantity from oldest FIFO batches. Use for damaged or missing stock.
          </Typography>
          <Stack spacing={2} component="form" onSubmit={adjustStock}>
            <FormControl required>
              <FormLabel>Product</FormLabel>
              <Select
                placeholder="Select product"
                value={selectedProductId}
                onChange={(_, v) => setSelectedProductId(v ?? "")}
                disabled={!hasProducts}
              >
                {products.map((p) => (
                  <Option key={String(p.id)} value={String(p.id)}>
                    {String(p.sku)} — {String(p.name)} (Stock: {String(p.total_stock)})
                  </Option>
                ))}
              </Select>
            </FormControl>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl required sx={{ flex: 1 }}>
                <FormLabel>Quantity to remove</FormLabel>
                <Input
                  type="number"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  disabled={!hasProducts}
                />
              </FormControl>
              <FormControl required sx={{ flex: 2 }}>
                <FormLabel>Reason</FormLabel>
                <Input
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Damaged, expired, inventory count…"
                  disabled={!hasProducts}
                />
              </FormControl>
            </Stack>
            <Button type="submit" color="danger" variant="outlined" loading={adjusting} disabled={!hasProducts}>
              Adjust Stock
            </Button>
            {adjustMessage && (
              <Typography level="body-sm" color={adjustMessage.includes("Removed") ? "success" : "danger"}>
                {adjustMessage}
              </Typography>
            )}
          </Stack>
        </Card>
      )}

      {adminMode && (
        <Card variant="outlined">
          <Typography level="title-md" mb={1}>
            Recent Adjustments
          </Typography>
          {adjData?.tableMissing ? (
            <Alert color="warning" variant="soft">
              Run migration 006 (<code>inventory_adjustments</code>) to enable adjustment history.
            </Alert>
          ) : (
            <Table size="sm">
              <thead>
                <tr>
                  <th>When</th>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Qty removed</th>
                  <th>Reason</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {(adjData?.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <Typography level="body-sm" textColor="neutral.500" sx={{ py: 1 }}>
                        No adjustments recorded yet.
                      </Typography>
                    </td>
                  </tr>
                ) : (
                  (adjData?.data ?? []).map((row: Record<string, unknown>) => (
                    <tr key={String(row.id)}>
                      <td>{new Date(String(row.createdAt)).toLocaleString()}</td>
                      <td>{String(row.sku)}</td>
                      <td>{String(row.productName)}</td>
                      <td>{String(row.quantityRemoved)}</td>
                      <td>{String(row.reason)}</td>
                      <td>{String(row.recordedBy)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      <Card variant="outlined">
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography level="title-md">Stock List</Typography>
          <Input
            placeholder="Search…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            sx={{ width: 240 }}
          />
        </Stack>
        {isLoading ? (
          <TableSkeleton rows={8} columns={5} />
        ) : (
          <Stack spacing={2}>
            <Table size="sm" stickyHeader>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Brand</th>
                  <th>Stock</th>
                  <th>Price</th>
                  {adminMode && <th />}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const brand = p.brand as { name: string } | undefined;
                  return (
                    <tr key={String(p.id)}>
                      <td>{String(p.sku)}</td>
                      <td>{String(p.name)}</td>
                      <td>{brand?.name ?? "—"}</td>
                      <td>
                        <Chip
                          size="sm"
                          color={p.is_low_stock ? "danger" : "success"}
                          variant="soft"
                        >
                          {String(p.total_stock)}
                        </Chip>
                      </td>
                      <td>{formatCurrency(Number(p.selling_price))}</td>
                      {adminMode && (
                        <td>
                          <Button
                            size="sm"
                            variant="plain"
                            onClick={() =>
                              setBatchProduct({
                                id: String(p.id),
                                label: `${String(p.sku)} — ${String(p.name)}`,
                              })
                            }
                          >
                            Batches
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            {!hasProducts && (
              <Typography level="body-sm" textColor="neutral.500" sx={{ py: 2, textAlign: "center" }}>
                No products in catalog. {adminMode && onAddProduct && (
                  <Button size="sm" variant="plain" onClick={onAddProduct}>
                    Add your first product
                  </Button>
                )}
              </Typography>
            )}
            <Pagination
              page={data?.page ?? 1}
              totalPages={data?.totalPages ?? 1}
              onPageChange={setPage}
            />
          </Stack>
        )}
      </Card>

      <BatchHistoryModal
        open={!!batchProduct}
        productId={batchProduct?.id ?? null}
        productLabel={batchProduct?.label}
        onClose={() => setBatchProduct(null)}
        showCosts={adminMode}
      />
    </Stack>
  );
}
