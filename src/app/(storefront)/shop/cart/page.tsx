"use client";

import Link from "next/link";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Stack from "@mui/joy/Stack";
import Table from "@mui/joy/Table";
import Typography from "@mui/joy/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import { formatCurrency } from "@/lib/utils";
import { useCart } from "@/components/storefront/CartProvider";

export default function CartPage() {
  const { items, subtotal, updateQuantity, removeItem } = useCart();

  if (!items.length) {
    return (
      <Stack spacing={2}>
        <Typography level="h3">Your cart is empty</Typography>
        <Button component={Link} href="/shop">
          Browse parts
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Typography level="h3">Cart</Typography>
      <Card variant="outlined" sx={{ p: 2 }}>
        <Table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Qty</th>
              <th>Price</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.productId}>
                <td>
                  <Typography level="body-sm">{item.name}</Typography>
                  <Typography level="body-xs" textColor="neutral.500">
                    {item.sku}
                  </Typography>
                </td>
                <td>
                  <Input
                    type="number"
                    slotProps={{ input: { min: 1, max: 99 } }}
                    value={item.quantity}
                    onChange={(e) =>
                      updateQuantity(item.productId, parseInt(e.target.value, 10) || 0)
                    }
                    sx={{ width: 72 }}
                  />
                </td>
                <td>{formatCurrency(item.unitPrice * item.quantity)}</td>
                <td>
                  <IconButton size="sm" color="danger" onClick={() => removeItem(item.productId)}>
                    <DeleteIcon />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography level="title-lg">Subtotal: {formatCurrency(subtotal)}</Typography>
        <Button component={Link} href="/shop/checkout">
          Proceed to checkout
        </Button>
      </Stack>
    </Stack>
  );
}
