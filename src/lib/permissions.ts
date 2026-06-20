import type { UserRole } from "@/types";

export const ADMIN_ONLY_PATHS = ["/reports", "/settings", "/analytics"];

export const STAFF_ONLY_PREFIXES = [
  "/dashboard",
  "/pos",
  "/sales",
  "/inventory",
  "/customers",
  "/reports",
  "/analytics",
  "/settings",
  "/web-orders",
];

export function isAdmin(role: UserRole): boolean {
  return role === "ADMIN";
}

export function isStaff(role: UserRole): boolean {
  return role === "ADMIN" || role === "CASHIER";
}

export function isCustomer(role: UserRole): boolean {
  return role === "CUSTOMER";
}

export function canAccessPath(role: UserRole, path: string): boolean {
  if (isCustomer(role)) {
    return !STAFF_ONLY_PREFIXES.some((p) => path.startsWith(p));
  }
  if (role === "ADMIN") return true;
  if (ADMIN_ONLY_PATHS.some((p) => path.startsWith(p))) return false;
  return true;
}
