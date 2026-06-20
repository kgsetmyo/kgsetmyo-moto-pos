"use client";

import { useRef, useState } from "react";
import Button from "@mui/joy/Button";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import ModalClose from "@mui/joy/ModalClose";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Table from "@mui/joy/Table";
import Chip from "@mui/joy/Chip";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";

interface ImportResult {
  created: number;
  skipped: number;
  errors: number;
  results: Array<{ sku: string; status: string; message?: string }>;
}

interface ProductCsvImportProps {
  onImported: () => void;
}

export function ProductCsvImport({ onImported }: ProductCsvImportProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/products/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(data);
      if (data.created > 0) onImported();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="outlined"
        startDecorator={<UploadFileIcon />}
        onClick={() => {
          setResult(null);
          setOpen(true);
        }}
      >
        Import CSV
      </Button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <ModalDialog sx={{ minWidth: 480, maxWidth: 640 }}>
          <ModalClose />
          <Typography level="h4">Import Products (CSV)</Typography>
          <Typography level="body-sm" textColor="neutral.500">
            Columns: sku, name, brand, category, barcode, low_stock_threshold, bike_brand,
            bike_model, year. Repeat SKU rows to add multiple bike compatibilities.
          </Typography>

          <Stack direction="row" spacing={1}>
            <Button
              component="a"
              href="/api/products/import"
              download="product-import-template.csv"
              variant="outlined"
              startDecorator={<DownloadIcon />}
            >
              Template
            </Button>
            <Button loading={loading} onClick={() => fileRef.current?.click()}>
              Choose CSV File
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
          </Stack>

          {result && (
            <Stack spacing={1}>
              <Stack direction="row" spacing={1}>
                <Chip color="success" variant="soft">
                  Created: {result.created}
                </Chip>
                <Chip color="warning" variant="soft">
                  Skipped: {result.skipped}
                </Chip>
                <Chip color="danger" variant="soft">
                  Errors: {result.errors}
                </Chip>
              </Stack>
              {result.results.length > 0 && (
                <Table size="sm" sx={{ maxHeight: 240, overflow: "auto" }}>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Status</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((r) => (
                      <tr key={r.sku}>
                        <td>{r.sku}</td>
                        <td>{r.status}</td>
                        <td>{r.message ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Stack>
          )}
        </ModalDialog>
      </Modal>
    </>
  );
}
