import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthFromCookies } from "@/lib/supabase/session";
import type { Profile, UserRole } from "@/types";

function normalizeRole(role: string | null | undefined): UserRole {
  const r = role?.toUpperCase();
  if (r === "ADMIN") return "ADMIN";
  if (r === "CUSTOMER") return "CUSTOMER";
  return "CASHIER";
}

function isAdminEmail(email: string | null | undefined) {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@moto-parts.shop";
  return email?.toLowerCase() === adminEmail.toLowerCase();
}

function createUserClient(accessToken: string) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

async function resolveAuth() {
  return getAuthFromCookies();
}

async function ensureProfile(userId: string, emailHint?: string) {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (existing) {
    if (isAdminEmail(existing.email) && existing.role !== "ADMIN") {
      const { data: upgraded } = await admin
        .from("profiles")
        .update({ role: "ADMIN", is_active: true })
        .eq("id", userId)
        .select("id, email, full_name, role, is_active")
        .single();
      return upgraded ?? existing;
    }
    return existing;
  }

  const { data: authData } = await admin.auth.admin.getUserById(userId);
  const email = emailHint ?? authData.user?.email ?? "";
  const fullName =
    (authData.user?.user_metadata?.full_name as string | undefined) ??
    email.split("@")[0] ??
    "User";

  const { data: created, error } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        role: isAdminEmail(email) ? "ADMIN" : "CASHIER",
        is_active: true,
      },
      { onConflict: "id" }
    )
    .select("id, email, full_name, role, is_active")
    .single();

  if (error) throw error;
  return created;
}

async function loadProfileRow(userId: string, accessToken?: string, emailHint?: string) {
  if (accessToken) {
    const userClient = createUserClient(accessToken);
    const { data, error } = await userClient
      .from("profiles")
      .select("id, email, full_name, role, is_active")
      .eq("id", userId)
      .maybeSingle();

    if (!error && data) return data;
  }

  return ensureProfile(userId, emailHint);
}

export async function getSessionUser() {
  const auth = await resolveAuth();
  if (!auth) return null;
  return { id: auth.userId, email: auth.email };
}

export async function getProfile(): Promise<Profile | null> {
  const auth = await resolveAuth();
  if (!auth) return null;

  try {
    const data = await loadProfileRow(auth.userId, auth.accessToken, auth.email);
    if (!data) return null;

    return {
      id: data.id,
      email: data.email ?? auth.email ?? "",
      full_name: data.full_name ?? "",
      role: normalizeRole(data.role),
      is_active: data.is_active ?? true,
    };
  } catch {
    return null;
  }
}

export async function requireProfile(allowedRoles?: UserRole[]) {
  const profile = await getProfile();
  if (!profile || !profile.is_active) {
    throw new Error("Unauthorized");
  }
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    throw new Error("Forbidden");
  }
  return profile;
}
