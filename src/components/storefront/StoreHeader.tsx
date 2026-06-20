"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Badge from "@mui/joy/Badge";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import TwoWheelerIcon from "@mui/icons-material/TwoWheeler";
import { useCart } from "@/components/storefront/CartProvider";

export function StoreHeader() {
  const pathname = usePathname();
  const { itemCount } = useCart();

  return (
    <Box
      component="header"
      sx={{
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "background.surface",
        position: "sticky",
        top: 0,
        zIndex: 1000,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ maxWidth: 1200, mx: "auto", px: 2, py: 1.5 }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <TwoWheelerIcon color="primary" />
          <Link href="/shop" style={{ textDecoration: "none", color: "inherit" }}>
            <Typography level="title-lg">Moto Parts Shop</Typography>
          </Link>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            component={Link}
            href="/shop"
            size="sm"
            variant={pathname === "/shop" ? "soft" : "plain"}
          >
            Catalog
          </Button>
          <Button
            component={Link}
            href="/shop/orders"
            size="sm"
            variant={pathname.startsWith("/shop/orders") ? "soft" : "plain"}
          >
            My orders
          </Button>
          <Button
            component={Link}
            href="/shop/account"
            size="sm"
            variant={pathname.startsWith("/shop/account") ? "soft" : "plain"}
          >
            Account
          </Button>
          <IconButton component={Link} href="/shop/cart" variant="outlined" size="sm">
            <Badge badgeContent={itemCount} color="primary">
              <ShoppingCartIcon />
            </Badge>
          </IconButton>
          <Button component={Link} href="/login" size="sm" variant="outlined" color="neutral">
            Staff
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
