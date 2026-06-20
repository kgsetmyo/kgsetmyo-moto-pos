"use client";

import { useState } from "react";
import Typography from "@mui/joy/Typography";
import Stack from "@mui/joy/Stack";
import Tabs from "@mui/joy/Tabs";
import TabList from "@mui/joy/TabList";
import Tab from "@mui/joy/Tab";
import TabPanel from "@mui/joy/TabPanel";
import Alert from "@mui/joy/Alert";
import Button from "@mui/joy/Button";
import { InventoryPanel } from "@/components/inventory/InventoryPanel";
import { ProductsPanel } from "@/components/inventory/ProductsPanel";
import { InventoryValuationCard } from "@/components/inventory/InventoryValuationCard";
import { useProfile } from "@/hooks/useProfile";
import { CardSkeleton } from "@/components/ui/Skeletons";
import AddIcon from "@mui/icons-material/Add";
import InventoryIcon from "@mui/icons-material/Inventory";

export default function InventoryPage() {
  const [tab, setTab] = useState(0);
  const { isAdmin, isLoading, profile, error } = useProfile();

  function scrollToReceiveStock() {
    setTab(0);
    requestAnimationFrame(() => {
      document.getElementById("receive-stock")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  if (isLoading) {
    return (
      <Stack spacing={2}>
        <Typography level="h2">Inventory</Typography>
        <CardSkeleton />
      </Stack>
    );
  }

  if (!profile) {
    return (
      <Stack spacing={2}>
        <Typography level="h2">Inventory</Typography>
        <Alert color="danger" variant="soft">
          Could not load your profile ({error?.message ?? "session error"}). Sign out and sign in
          again. If you are admin, run the SQL in Supabase to set role = ADMIN on your profile.
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Typography level="h2">Inventory</Typography>
        {isAdmin && (
          <Stack direction="row" spacing={1}>
            <Button
              startDecorator={<AddIcon />}
              onClick={() => setTab(1)}
              variant={tab === 1 ? "solid" : "outlined"}
            >
              Add Product
            </Button>
            <Button
              startDecorator={<InventoryIcon />}
              onClick={scrollToReceiveStock}
              variant="outlined"
            >
              Receive Stock
            </Button>
          </Stack>
        )}
      </Stack>

      {!isAdmin && (
        <Alert color="neutral" variant="soft">
          Cashier view — stock levels only. Cost prices and product management are admin-only.
        </Alert>
      )}

      {isAdmin && (
        <Alert color="primary" variant="soft">
          <strong>Admin:</strong> (1) <em>Add Product</em> to create a catalog item, then (2){" "}
          <em>Receive Stock</em> to add quantity with cost/sell price (FIFO batch).
        </Alert>
      )}

      {isAdmin && <InventoryValuationCard />}

      <Tabs value={tab} onChange={(_, v) => setTab(v as number)}>
        <TabList>
          <Tab>Stock &amp; Receive</Tab>
          {isAdmin && <Tab>Products (Catalog)</Tab>}
        </TabList>
        <TabPanel value={0} sx={{ p: 0, pt: 2 }}>
          <InventoryPanel adminMode={isAdmin} onAddProduct={() => setTab(1)} />
        </TabPanel>
        {isAdmin && (
          <TabPanel value={1} sx={{ p: 0, pt: 2 }}>
            <ProductsPanel />
          </TabPanel>
        )}
      </Tabs>
    </Stack>
  );
}
