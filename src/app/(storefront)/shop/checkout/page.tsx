"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/joy/Alert";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Checkbox from "@mui/joy/Checkbox";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { useCart } from "@/components/storefront/CartProvider";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clear } = useCart();
  const [payAtPickup, setPayAtPickup] = useState(true);
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCheckout() {
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      router.push("/shop/account?redirect=/shop/checkout");
      return;
    }

    const res = await fetch("/api/store/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        payAtPickup,
        paymentReference: reference || undefined,
      }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Checkout failed");
      setLoading(false);
      return;
    }

    clear();
    router.push("/shop/orders");
  }

  if (!items.length) {
    return <Alert color="warning">Your cart is empty.</Alert>;
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 560 }}>
      <Typography level="h3">Click & collect checkout</Typography>
      <Card variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography level="body-md">
            Total: <strong>{formatCurrency(subtotal)}</strong>
          </Typography>
          <FormControl orientation="horizontal">
            <Checkbox
              checked={payAtPickup}
              onChange={(e) => setPayAtPickup(e.target.checked)}
              label="Pay when I pick up at the store"
            />
          </FormControl>
          {!payAtPickup && (
            <FormControl>
              <FormLabel>Mobile banking reference</FormLabel>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Transfer reference"
              />
            </FormControl>
          )}
          {error && (
            <Typography level="body-sm" color="danger">
              {error}
            </Typography>
          )}
          <Button loading={loading} onClick={handleCheckout}>
            Place order for pickup
          </Button>
        </Stack>
      </Card>
    </Stack>
  );
}
