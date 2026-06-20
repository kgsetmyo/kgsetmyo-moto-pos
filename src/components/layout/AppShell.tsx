"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import Box from "@mui/joy/Box";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import ListItemButton from "@mui/joy/ListItemButton";
import ListItemContent from "@mui/joy/ListItemContent";
import Sheet from "@mui/joy/Sheet";
import Typography from "@mui/joy/Typography";
import Chip from "@mui/joy/Chip";
import Button from "@mui/joy/Button";
import Divider from "@mui/joy/Divider";
import Stack from "@mui/joy/Stack";
import IconButton from "@mui/joy/IconButton";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import InventoryIcon from "@mui/icons-material/Inventory";
import PeopleIcon from "@mui/icons-material/People";
import StorefrontIcon from "@mui/icons-material/Storefront";
import AssessmentIcon from "@mui/icons-material/Assessment";
import InsightsIcon from "@mui/icons-material/Insights";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import { useProfile } from "@/hooks/useProfile";
import { canAccessPath, isCustomer } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/pos", label: "POS", icon: PointOfSaleIcon },
  { href: "/web-orders", label: "Web orders", icon: StorefrontIcon },
  { href: "/sales", label: "Sales", icon: ReceiptLongIcon },
  { href: "/inventory", label: "Inventory", icon: InventoryIcon },
  { href: "/customers", label: "Customers", icon: PeopleIcon },
  { href: "/reports", label: "Reports", icon: AssessmentIcon, adminOnly: true },
  { href: "/analytics", label: "Analytics", icon: InsightsIcon, adminOnly: true },
  { href: "/settings", label: "Settings", icon: SettingsIcon, adminOnly: true },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { profile, isAdmin, isLoading } = useProfile();
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const visibleNav = NAV.filter((item) => !item.adminOnly || isAdmin);

  return (
    <Sheet
      sx={{
        width: 240,
        height: "100vh",
        position: "fixed",
        left: 0,
        top: 0,
        borderRight: "1px solid",
        borderColor: "divider",
        p: 2,
        display: { xs: "none", md: "flex" },
        flexDirection: "column",
      }}
    >
      <Typography level="h4" mb={1}>
        Moto POS
      </Typography>

      {!isLoading && profile && (
        <Stack spacing={0.5} mb={2}>
          <Typography level="body-xs" textColor="neutral.500">
            {profile.full_name}
          </Typography>
          <Chip size="sm" variant="soft" color={isAdmin ? "primary" : "neutral"}>
            {profile.role}
          </Chip>
        </Stack>
      )}

      <List size="sm" sx={{ flex: 1 }}>
        {visibleNav.map(({ href, label, icon: Icon }) => (
          <ListItem key={href}>
            <ListItemButton
              component={Link}
              href={href}
              selected={pathname.startsWith(href)}
            >
              <Icon fontSize="small" />
              <ListItemContent>{label}</ListItemContent>
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider sx={{ my: 1 }} />
      <Button
        size="sm"
        variant="plain"
        color="neutral"
        startDecorator={<LogoutIcon />}
        onClick={() => void logout()}
      >
        Sign out
      </Button>
    </Sheet>
  );
}

function MobileNav() {
  const pathname = usePathname();
  const { isAdmin } = useProfile();
  const visibleNav = NAV.filter((item) => !item.adminOnly || isAdmin);

  return (
    <Sheet
      sx={{
        display: { xs: "flex", md: "none" },
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        borderTop: "1px solid",
        borderColor: "divider",
        zIndex: 1000,
        px: 1,
        py: 0.5,
        justifyContent: "space-around",
        bgcolor: "background.surface",
      }}
    >
      {visibleNav.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <IconButton
            key={href}
            component={Link}
            href={href}
            variant={active ? "soft" : "plain"}
            color={active ? "primary" : "neutral"}
            sx={{ flexDirection: "column", borderRadius: "sm", px: 1.5, py: 0.5, gap: 0.25 }}
          >
            <Icon fontSize="small" />
            <Typography level="body-xs">{label}</Typography>
          </IconButton>
        );
      })}
    </Sheet>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, isLoading } = useProfile();

  useEffect(() => {
    if (isLoading) return;
    if (isCustomer(role)) {
      router.replace("/shop");
      return;
    }
    if (!canAccessPath(role, pathname)) {
      router.replace("/dashboard");
    }
  }, [isLoading, role, pathname, router]);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppSidebar />
      <Box
        component="main"
        sx={{
          flex: 1,
          ml: { md: "240px" },
          p: { xs: 2, md: 3 },
          pb: { xs: 10, md: 3 },
          bgcolor: "background.level1",
        }}
      >
        {children}
      </Box>
      <MobileNav />
    </Box>
  );
}
