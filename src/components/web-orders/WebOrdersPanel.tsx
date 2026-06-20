"use client";

import useSWR from "swr";
import Alert from "@mui/joy/Alert";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Stack from "@mui/joy/Stack";
import Table from "@mui/joy/Table";
import Typography from "@mui/joy/Typography";
import { useState } from "react";
import { jsonFetcher } from "@/lib/api/fetcher";
import { formatCurrency } from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/Skeletons";
import { useWebOrderAlerts } from "@/hooks/useWebOrderAlerts";

interface WebOrder {
  id: string;
  invoiceNumber: string;
  total: number;
  fulfillmentStatus: string;
  createdAt: string;
  customerName: string;
  customerPhone: string | null;
  amountDue: number;
  lineItems: Array<{ sku: string; name: string; quantity: number }>;
}

export function WebOrdersPanel() {
  const { data, isLoading, mutate } = useSWR("/api/web-orders", jsonFetcher);
  const { pendingCount, lastAlert, clearAlert } = useWebOrderAlerts(true);
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [cashAmount, setCashAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const orders = (data?.orders as WebOrder[]) ?? [];

  async function action(path: string, body?: object) {
    setBusy(path);
    await fetch(path, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(null);
    await mutate();
  }

  return (
    <Stack spacing={2}>
      {lastAlert && (
        <Alert color="primary" variant="soft" endDecorator={<Button size="sm" onClick={clearAlert}>Dismiss</Button>}>
          {lastAlert}
        </Alert>
      )}

      <Stack direction="row" spacing={1} alignItems="center">
        <Typography level="h3">Web orders (click & collect)</Typography>
        <Chip color={pendingCount ? "danger" : "success"} variant="soft">
          {pendingCount} pending
        </Chip>
      </Stack>

      {isLoading ? (
        <TableSkeleton rows={4} columns={6} />
      ) : !orders.length ? (
        <Typography level="body-md" textColor="neutral.500">
          No active web orders — new orders appear here in real time.
        </Typography>
      ) : (
        <Card variant="outlined" sx={{ overflow: "auto" }}>
          <Table stickyHeader size="sm">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Due</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.invoiceNumber}</td>
                  <td>
                    {order.customerName}
                    {order.customerPhone && (
                      <Typography level="body-xs">{order.customerPhone}</Typography>
                    )}
                  </td>
                  <td>
                    {order.lineItems.map((li) => (
                      <Typography key={li.sku} level="body-xs">
                        {li.quantity}× {li.name}
                      </Typography>
                    ))}
                  </td>
                  <td>{formatCurrency(order.total)}</td>
                  <td>{formatCurrency(order.amountDue)}</td>
                  <td>
                    <Chip size="sm" variant="soft">
                      {order.fulfillmentStatus}
                    </Chip>
                  </td>
                  <td>
                    <Stack direction="row" spacing={0.5}>
                      {order.fulfillmentStatus === "PENDING" && (
                        <Button
                          size="sm"
                          loading={busy === `/api/web-orders/${order.id}/pick`}
                          onClick={() => action(`/api/web-orders/${order.id}/pick`)}
                        >
                          Mark picked
                        </Button>
                      )}
                      {order.fulfillmentStatus !== "COMPLETED" && (
                        <Button
                          size="sm"
                          variant="soft"
                          color="success"
                          onClick={() => {
                            setCompleteId(order.id);
                            setCashAmount(String(order.amountDue));
                          }}
                        >
                          Complete
                        </Button>
                      )}
                      {order.fulfillmentStatus !== "COMPLETED" && (
                        <Button
                          size="sm"
                          variant="plain"
                          color="danger"
                          loading={busy === `/api/web-orders/${order.id}/cancel`}
                          onClick={() =>
                            action(`/api/web-orders/${order.id}/cancel`, {
                              reason: "Cancelled by cashier",
                            })
                          }
                        >
                          Cancel
                        </Button>
                      )}
                    </Stack>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Modal open={!!completeId} onClose={() => setCompleteId(null)}>
        <ModalDialog>
          <Typography level="title-md" mb={2}>
            Collect payment & complete pickup
          </Typography>
          <FormControl>
            <FormLabel>Cash amount (0 if already paid online)</FormLabel>
            <Input value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} type="number" />
          </FormControl>
          <Stack direction="row" spacing={1} mt={2} justifyContent="flex-end">
            <Button variant="plain" onClick={() => setCompleteId(null)}>
              Close
            </Button>
            <Button
              loading={!!completeId && busy === `/api/web-orders/${completeId}/complete`}
              onClick={async () => {
                if (!completeId) return;
                const amount = parseFloat(cashAmount) || 0;
                const payments =
                  amount > 0 ? [{ method: "CASH" as const, amount }] : [];
                await action(`/api/web-orders/${completeId}/complete`, { payments });
                setCompleteId(null);
              }}
            >
              Complete pickup
            </Button>
          </Stack>
        </ModalDialog>
      </Modal>
    </Stack>
  );
}
