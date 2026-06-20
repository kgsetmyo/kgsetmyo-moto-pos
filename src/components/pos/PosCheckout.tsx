"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Alert from "@mui/joy/Alert";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Table from "@mui/joy/Table";
import Typography from "@mui/joy/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import useSWR from "swr";
import type { CartLine, PaymentMethod, ProductSearchResult } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { getBusinessDateString } from "@/lib/business-date";
import { PosSkeleton } from "@/components/ui/Skeletons";
import { ThermalReceipt } from "@/components/pos/ThermalReceipt";
import { useProfile } from "@/hooks/useProfile";
import type { SelectedCustomer } from "@/components/pos/CustomerPicker";
import {
  SplitPaymentPanel,
  validatePayments,
  paymentsToPayload,
  initialPayments,
  type PaymentLine,
} from "@/components/pos/SplitPaymentPanel";
import { PosBikeFilters, type BikeFilters } from "@/components/pos/PosBikeFilters";

import { jsonFetcher } from "@/lib/api/fetcher";

const PAYMENT_SHORTCUTS: Record<string, PaymentMethod> = {
  F2: "CASH",
  F3: "MOBILE_BANKING",
  F4: "CREDIT",
};

export function PosCheckout() {
  const searchRef = useRef<HTMLInputElement>(null);
  const { isAdmin } = useProfile();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<SelectedCustomer | null>(null);
  const [payments, setPayments] = useState<PaymentLine[]>(initialPayments());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState<Record<string, unknown> | null>(null);
  const [discount, setDiscount] = useState("");
  const [bikeFilters, setBikeFilters] = useState<BikeFilters>({
    bikeBrand: "",
    bikeModel: "",
    year: "",
  });

  const subtotal = cart.reduce((s, l) => s + l.lineTotal, 0);
  const discountAmount = Math.max(0, parseFloat(discount) || 0);
  const total = Math.max(0, subtotal - discountAmount);
  const businessDate = getBusinessDateString();

  const { data: dayStatus } = useSWR(
    `/api/reports?type=day-status&date=${businessDate}`,
    async (url: string) => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return { closed: false };
      return res.json();
    },
    { refreshInterval: 60_000 }
  );
  const dayClosed = dayStatus?.closed === true;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const hasBikeFilter =
    bikeFilters.bikeBrand || bikeFilters.bikeModel || bikeFilters.year.trim();
  const searchActive = debouncedQuery.length >= 1 || hasBikeFilter;

  const productSearchUrl = searchActive
    ? `/api/products?${[
        debouncedQuery ? `q=${encodeURIComponent(debouncedQuery)}` : "",
        bikeFilters.bikeBrand ? `bikeBrand=${encodeURIComponent(bikeFilters.bikeBrand)}` : "",
        bikeFilters.bikeModel ? `bikeModel=${encodeURIComponent(bikeFilters.bikeModel)}` : "",
        bikeFilters.year.trim() ? `year=${encodeURIComponent(bikeFilters.year.trim())}` : "",
        "pageSize=12",
      ]
        .filter(Boolean)
        .join("&")}`
    : null;

  const { data, isLoading } = useSWR(productSearchUrl, jsonFetcher, { keepPreviousData: true });

  const addToCart = useCallback((product: ProductSearchResult) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id
            ? {
                ...l,
                quantity: l.quantity + 1,
                lineTotal: (l.quantity + 1) * l.unitPrice,
              }
            : l
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          quantity: 1,
          unitPrice: product.selling_price,
          lineTotal: product.selling_price,
        },
      ];
    });
    setQuery("");
    searchRef.current?.focus();
  }, []);

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.productId !== productId) return l;
          const quantity = Math.max(1, l.quantity + delta);
          return { ...l, quantity, lineTotal: quantity * l.unitPrice };
        })
        .filter((l) => l.quantity > 0)
    );
  };

  const removeLine = (productId: string) => {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  };

  const updateUnitPrice = (productId: string, unitPrice: number) => {
    if (unitPrice <= 0) return;
    setCart((prev) =>
      prev.map((l) =>
        l.productId === productId
          ? { ...l, unitPrice, lineTotal: l.quantity * unitPrice }
          : l
      )
    );
  };

  const handleBarcodeScan = (value: string) => {
    if (value.length < 3) return;
    fetch(`/api/products?q=${encodeURIComponent(value)}&pageSize=1`)
      .then((r) => r.json())
      .then((res) => {
        if (res.data?.[0]) addToCart(res.data[0]);
      });
  };

  const checkout = useCallback(async () => {
    if (cart.length === 0 || dayClosed) return;

    const validationError = validatePayments(payments, total, customer);
    if (validationError) {
      alert(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const paymentPayload = paymentsToPayload(payments, total);
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer?.id,
          discount: discountAmount > 0 ? discountAmount : undefined,
          lines: cart.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
          payments: paymentPayload,
        }),
      });
      const sale = await res.json();
      if (!res.ok) throw new Error(sale.error ?? "Checkout failed");

      setLastSale({ ...sale, payments: paymentPayload });
      setCart([]);
      setCustomer(null);
      setPayments(initialPayments());
      setDiscount("");
      setQuery("");
      searchRef.current?.focus();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setIsSubmitting(false);
    }
  }, [cart, customer, dayClosed, discountAmount, payments, total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (PAYMENT_SHORTCUTS[e.key] && payments.length === 1) {
        e.preventDefault();
        setPayments([{ ...payments[0], method: PAYMENT_SHORTCUTS[e.key] }]);
      }
      if (e.key === "F9" && cart.length > 0 && !isSubmitting && !dayClosed) {
        e.preventDefault();
        void checkout();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cart.length, checkout, isSubmitting, payments, dayClosed]);

  if (!data && isLoading && searchActive) return <PosSkeleton />;

  return (
    <Stack spacing={2}>
      {dayClosed && (
        <Alert color="warning" variant="soft">
          Business day {businessDate} is closed. New sales are blocked until tomorrow.
        </Alert>
      )}
    <Stack direction={{ xs: "column", lg: "row" }} spacing={2} sx={{ minHeight: "75vh" }}>
      <Sheet variant="outlined" sx={{ flex: 2, p: 2, borderRadius: "md" }}>
        <Stack spacing={2}>
          <Input
            ref={searchRef}
            startDecorator={<SearchIcon />}
            placeholder="Scan barcode or search SKU, name, brand, bike model… (F1)"
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);
              if (v.length >= 8 && /^\d+$/.test(v)) handleBarcodeScan(v);
            }}
            autoFocus
            size="lg"
          />

          <PosBikeFilters filters={bikeFilters} onChange={setBikeFilters} />

          <Typography level="body-xs" textColor="neutral.500">
            Shortcuts: F1 Search · F2/F3/F4 payment method · F9 Checkout · Split for mixed payments
          </Typography>

          <Box sx={{ maxHeight: 360, overflow: "auto" }}>
            {data?.data?.map((product: ProductSearchResult) => (
              <Sheet
                key={product.id}
                variant="soft"
                sx={{
                  p: 1.5,
                  mb: 1,
                  borderRadius: "sm",
                  cursor: "pointer",
                  "&:hover": { bgcolor: "primary.softBg" },
                }}
                onClick={() => addToCart(product)}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography level="title-sm">{product.name}</Typography>
                    <Typography level="body-xs">
                      {product.sku} · {product.brand.name}
                    </Typography>
                    {product.compatibilities?.slice(0, 2).map((c, i) => (
                      <Chip key={i} size="sm" variant="outlined" sx={{ mr: 0.5, mt: 0.5 }}>
                        {c.bike_model.bike_brand.name} {c.bike_model.name} {c.year}
                      </Chip>
                    ))}
                  </Box>
                  <Stack alignItems="flex-end" spacing={0.5}>
                    <Typography level="title-md">
                      {formatCurrency(product.selling_price)}
                    </Typography>
                    <Chip
                      size="sm"
                      color={product.is_low_stock ? "danger" : "success"}
                      variant="soft"
                    >
                      Stock: {product.total_stock}
                    </Chip>
                  </Stack>
                </Stack>
              </Sheet>
            ))}
          </Box>
        </Stack>
      </Sheet>

      <Sheet variant="outlined" sx={{ flex: 1, p: 2, borderRadius: "md" }}>
        <Typography level="h4" mb={1}>
          Cart
        </Typography>
        <Divider sx={{ mb: 1 }} />

        {cart.length === 0 ? (
          <Typography level="body-sm" textColor="neutral.500">
            Cart is empty. Scan or search to add items.
          </Typography>
        ) : (
          <Table size="sm" stickyHeader>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                {isAdmin && <th>Price</th>}
                <th>Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cart.map((line) => (
                <tr key={line.productId}>
                  <td>
                    <Typography level="body-sm">{line.name}</Typography>
                    <Typography level="body-xs">{line.sku}</Typography>
                  </td>
                  <td>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <IconButton size="sm" onClick={() => updateQty(line.productId, -1)}>
                        -
                      </IconButton>
                      <Typography level="body-sm">{line.quantity}</Typography>
                      <IconButton size="sm" onClick={() => updateQty(line.productId, 1)}>
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </td>
                  {isAdmin && (
                    <td>
                      <Input
                        size="sm"
                        type="number"
                        value={line.unitPrice}
                        onChange={(e) =>
                          updateUnitPrice(line.productId, parseFloat(e.target.value) || line.unitPrice)
                        }
                        sx={{ width: 90 }}
                      />
                    </td>
                  )}
                  <td>{formatCurrency(line.lineTotal)}</td>
                  <td>
                    <IconButton
                      size="sm"
                      color="danger"
                      onClick={() => removeLine(line.productId)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        <Divider sx={{ my: 2 }} />

        <Stack spacing={1}>
          {discountAmount > 0 && (
            <Typography level="body-sm" textColor="neutral.500">
              Subtotal: {formatCurrency(subtotal)} · Discount: −{formatCurrency(discountAmount)}
            </Typography>
          )}
          <Typography level="h3">{formatCurrency(total)}</Typography>

          {isAdmin && cart.length > 0 && (
            <FormControl>
              <FormLabel>Discount (MMK)</FormLabel>
              <Input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
              />
            </FormControl>
          )}

          <SplitPaymentPanel
            total={total}
            payments={payments}
            onChange={setPayments}
            customer={customer}
            onCustomerChange={setCustomer}
          />

          <Button
            size="lg"
            fullWidth
            loading={isSubmitting}
            disabled={cart.length === 0 || dayClosed}
            onClick={() => void checkout()}
          >
            {dayClosed ? "Day Closed" : "Checkout (F9)"}
          </Button>
        </Stack>

        {lastSale && (
          <Box sx={{ mt: 2 }}>
            <ThermalReceipt sale={lastSale} />
          </Box>
        )}
      </Sheet>
    </Stack>
    </Stack>
  );
}
