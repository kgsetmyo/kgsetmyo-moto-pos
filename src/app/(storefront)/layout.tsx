import type { Metadata } from "next";
import Box from "@mui/joy/Box";
import { CartProvider } from "@/components/storefront/CartProvider";
import { StoreFooter } from "@/components/storefront/StoreFooter";
import { StoreHeader } from "@/components/storefront/StoreHeader";

export const metadata: Metadata = {
  title: {
    default: "Moto Parts Shop",
    template: "%s | Moto Parts Shop",
  },
  description: "Browse motorcycle spare parts compatible with your bike. Click & collect in Yangon.",
};

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <StoreHeader />
        <Box component="main" sx={{ flex: 1, maxWidth: 1200, mx: "auto", width: "100%", px: 2, py: 3 }}>
          {children}
        </Box>
        <StoreFooter />
      </Box>
    </CartProvider>
  );
}
