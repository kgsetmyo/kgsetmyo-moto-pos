"use client";

import useSWR from "swr";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Table from "@mui/joy/Table";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/Skeletons";
import { jsonFetcher } from "@/lib/api/fetcher";

interface BatchHistoryModalProps {
  open: boolean;
  productId: string | null;
  productLabel?: string;
  onClose: () => void;
  showCosts?: boolean;
}

export function BatchHistoryModal({
  open,
  productId,
  productLabel,
  onClose,
  showCosts = false,
}: BatchHistoryModalProps) {
  const { data, isLoading } = useSWR(
    open && productId ? `/api/inventory/batches?productId=${productId}` : null,
    jsonFetcher
  );

  const batches = (data?.data ?? []) as Array<Record<string, unknown>>;

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ maxWidth: 720, width: "100%" }}>
        <Typography level="title-md" mb={2}>
          FIFO Batches — {productLabel ?? "Product"}
        </Typography>

        {isLoading ? (
          <TableSkeleton rows={4} columns={showCosts ? 6 : 4} />
        ) : batches.length === 0 ? (
          <Typography level="body-sm" textColor="neutral.500">
            No batches recorded for this product.
          </Typography>
        ) : (
          <Table size="sm">
            <thead>
              <tr>
                <th>Received</th>
                <th>Batch #</th>
                {showCosts && <th>Cost</th>}
                <th>Sell</th>
                <th>Recv</th>
                <th>Left</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={String(b.id)}>
                  <td>
                    <Typography level="body-xs">
                      {formatDateTime(String(b.receivedAt))}
                    </Typography>
                  </td>
                  <td>{String(b.batchNumber ?? "—")}</td>
                  {showCosts && <td>{formatCurrency(Number(b.costPrice))}</td>}
                  <td>{formatCurrency(Number(b.sellingPrice))}</td>
                  <td>{String(b.quantityReceived)}</td>
                  <td>{String(b.quantityRemaining)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        <Button variant="outlined" color="neutral" onClick={onClose} sx={{ mt: 2 }}>
          Close
        </Button>
      </ModalDialog>
    </Modal>
  );
}
