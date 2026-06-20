"use client";

import useSWR from "swr";
import { jsonFetcher } from "@/lib/api/fetcher";
import type { Profile, UserRole } from "@/types";
import { isAdmin, isCustomer } from "@/lib/permissions";

export function useProfile() {
  const { data, error, isLoading, mutate } = useSWR<Profile>("/api/me", jsonFetcher);

  const profile = data ?? null;

  return {
    profile,
    role: (profile?.role ?? "CASHIER") as UserRole,
    isAdmin: profile ? isAdmin(profile.role) : false,
    isCustomer: profile ? isCustomer(profile.role) : false,
    isLoading,
    error,
    refresh: mutate,
  };
}
