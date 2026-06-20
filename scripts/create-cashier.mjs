/**
 * Creates (or updates) a cashier account in Supabase Auth.
 * Usage: node --env-file=.env.local scripts/create-cashier.mjs
 */
import { createClient } from "@supabase/supabase-js";

const CASHIER_EMAIL = process.env.CASHIER_EMAIL ?? "cashier@moto-parts.shop";
const CASHIER_PASSWORD = process.env.CASHIER_PASSWORD ?? "cashier123456";
const CASHIER_NAME = process.env.CASHIER_NAME ?? "Shop Cashier";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceKey || !anonKey) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail() {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email === CASHIER_EMAIL);
}

async function ensureCashier() {
  console.log("Creating cashier account...\n");

  const existing = await findUserByEmail();
  let userId;

  if (existing) {
    console.log(`User already exists: ${CASHIER_EMAIL}`);
    userId = existing.id;
    await admin.auth.admin.updateUserById(userId, {
      password: CASHIER_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: CASHIER_NAME },
    });
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: CASHIER_EMAIL,
      password: CASHIER_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: CASHIER_NAME },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`Created user: ${CASHIER_EMAIL}`);
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: userId,
      email: CASHIER_EMAIL,
      full_name: CASHIER_NAME,
      role: "CASHIER",
      is_active: true,
    },
    { onConflict: "id" }
  );

  if (profileError) throw profileError;

  const anon = createClient(url, anonKey);
  const { error: signInError } = await anon.auth.signInWithPassword({
    email: CASHIER_EMAIL,
    password: CASHIER_PASSWORD,
  });
  if (signInError) throw signInError;

  console.log("\n✅ Cashier account ready");
  console.log("─────────────────────────────");
  console.log(`Email:    ${CASHIER_EMAIL}`);
  console.log(`Password: ${CASHIER_PASSWORD}`);
  console.log(`Role:     CASHIER`);
  console.log("─────────────────────────────");
}

ensureCashier().catch((err) => {
  console.error("\nFailed:", err?.message ?? err);
  process.exit(1);
});
