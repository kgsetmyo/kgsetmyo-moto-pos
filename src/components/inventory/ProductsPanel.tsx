"use client";

import { useState } from "react";
import useSWR from "swr";
import Card from "@mui/joy/Card";
import Button from "@mui/joy/Button";
import Input from "@mui/joy/Input";
import Stack from "@mui/joy/Stack";
import Table from "@mui/joy/Table";
import Typography from "@mui/joy/Typography";
import Chip from "@mui/joy/Chip";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import { TableSkeleton } from "@/components/ui/Skeletons";
import { Pagination } from "@/components/ui/Pagination";
import { ProductForm } from "@/components/inventory/ProductForm";
import { ProductCsvImport } from "@/components/inventory/ProductCsvImport";

import { jsonFetcher } from "@/lib/api/fetcher";

export function ProductsPanel() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();

  const { data, isLoading, mutate } = useSWR(
    `/api/products?q=${encodeURIComponent(q)}&page=${page}&pageSize=15`,
    jsonFetcher
  );

  function openCreate() {
    setEditId(undefined);
    setShowForm(true);
  }

  function openEdit(id: string) {
    setEditId(id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditId(undefined);
    void mutate();
  }

  async function deactivate(id: string) {
    if (!confirm("Deactivate this product? It will be hidden from POS and inventory.")) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? "Failed to deactivate");
      return;
    }
    void mutate();
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Input
          placeholder="Search products…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          sx={{ maxWidth: 320 }}
        />
        <Stack direction="row" spacing={1}>
          <ProductCsvImport onImported={() => void mutate()} />
          <Button onClick={openCreate}>+ Add Product</Button>
        </Stack>
      </Stack>

      <Card variant="outlined">
        {isLoading ? (
          <TableSkeleton rows={8} columns={6} />
        ) : (
          <Stack spacing={2}>
            <Table size="sm" stickyHeader>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Brand</th>
                  <th>Stock</th>
                  <th>Fits</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data?.data?.map((p: Record<string, unknown>) => {
                  const brand = p.brand as { name: string } | undefined;
                  const compat = (p.compatibilities ?? []) as Array<{
                    year: number;
                    bike_model: { name: string; bike_brand: { name: string } };
                  }>;
                  return (
                    <tr key={String(p.id)}>
                      <td>{String(p.sku)}</td>
                      <td>{String(p.name)}</td>
                      <td>{brand?.name ?? "—"}</td>
                      <td>
                        <Chip size="sm" color={p.is_low_stock ? "danger" : "success"} variant="soft">
                          {String(p.total_stock)}
                        </Chip>
                      </td>
                      <td>
                        <Typography level="body-xs">
                          {compat.slice(0, 2).map((c, i) => (
                            <span key={i}>
                              {c.bike_model.bike_brand.name} {c.bike_model.name} {c.year}
                              {i < Math.min(compat.length, 2) - 1 ? " · " : ""}
                            </span>
                          ))}
                          {compat.length > 2 ? ` +${compat.length - 2}` : ""}
                        </Typography>
                      </td>
                      <td>
                        <Stack direction="row" spacing={0.5}>
                          <Button size="sm" variant="plain" onClick={() => openEdit(String(p.id))}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="plain"
                            color="danger"
                            onClick={() => void deactivate(String(p.id))}
                          >
                            Deactivate
                          </Button>
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

      <Modal open={showForm} onClose={closeForm}>
        <ModalDialog sx={{ maxWidth: 720, maxHeight: "90vh", overflow: "auto" }}>
          <ProductForm
            productId={editId}
            onSaved={closeForm}
            onCancel={closeForm}
          />
        </ModalDialog>
      </Modal>
    </Stack>
  );
}
