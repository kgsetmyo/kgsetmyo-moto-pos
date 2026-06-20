import { createAdminClient } from "@/lib/supabase/admin";

export type ShopSettings = {
  businessName: string;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
};

const DEFAULTS: ShopSettings = {
  businessName: "Moto Parts POS",
  phone: null,
  address: null,
  logoUrl: null,
};

export async function getShopSettings(): Promise<ShopSettings> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("shop_settings")
    .select("business_name, phone, address, logo_url")
    .limit(1)
    .maybeSingle();

  if (error || !data) return DEFAULTS;

  return {
    businessName: data.business_name ?? DEFAULTS.businessName,
    phone: data.phone,
    address: data.address,
    logoUrl: data.logo_url,
  };
}

export async function updateShopSettings(input: {
  businessName: string;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
}) {
  const supabase = createAdminClient();
  const payload = {
    business_name: input.businessName.trim(),
    phone: input.phone?.trim() || null,
    address: input.address?.trim() || null,
    logo_url: input.logoUrl?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("shop_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from("shop_settings")
      .update(payload)
      .eq("id", existing.id)
      .select("business_name, phone, address, logo_url")
      .single();
    if (error) throw error;
    return {
      businessName: data.business_name,
      phone: data.phone,
      address: data.address,
      logoUrl: data.logo_url,
    };
  }

  const { data, error } = await supabase
    .from("shop_settings")
    .insert(payload)
    .select("business_name, phone, address, logo_url")
    .single();
  if (error) throw error;
  return {
    businessName: data.business_name,
    phone: data.phone,
    address: data.address,
    logoUrl: data.logo_url,
  };
}
