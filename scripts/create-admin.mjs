/**
 * Creates (or updates) a local admin account in Supabase Auth.
 * Usage: node --env-file=.env.local scripts/create-admin.mjs
 */
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@moto-parts.shop";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123456";
const ADMIN_NAME = process.env.ADMIN_NAME ?? "Shop Admin";

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

function logStepError(step, error) {
  console.error(`\n[${step}] failed:`);
  if (error) {
    console.error("  message:", error.message);
    console.error("  code:", error.code);
    console.error("  status:", error.status);
  }
}

async function findUserByEmail() {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email === ADMIN_EMAIL);
}

async function createOrUpdateUser() {
  const existing = await findUserByEmail();

  if (existing) {
    console.log(`User already exists: ${ADMIN_EMAIL}`);
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: ADMIN_NAME },
    });
    if (error) throw error;
    return data.user.id;
  }

  // Try admin API first
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: ADMIN_NAME },
  });

  if (!createError && created.user) {
    console.log(`Created user via admin API: ${ADMIN_EMAIL}`);
    return created.user.id;
  }

  if (createError) {
    console.warn("admin.createUser failed, trying signUp fallback...");
    logStepError("createUser", createError);
  }

  // Fallback: public sign-up then confirm with service role
  const anon = createClient(url, anonKey);
  const { data: signedUp, error: signUpError } = await anon.auth.signUp({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    options: { data: { full_name: ADMIN_NAME } },
  });

  if (signUpError) {
    logStepError("signUp", signUpError);
    console.error("\n⚠ Auth signup returned 500 — usually a broken database trigger.");
    console.error("Fix: open Supabase → SQL Editor → run:");
    console.error("  supabase/migrations/002_fix_auth_trigger.sql\n");
    console.error("Or create the user manually in Supabase → Authentication → Users → Add user");
    console.error("Then run: npm run admin:create  (will upgrade profile to ADMIN)\n");
    throw signUpError;
  }

  let userId = signedUp.user?.id;
  if (!userId) {
    const found = await findUserByEmail();
    userId = found?.id;
  }

  if (!userId) {
    throw new Error("Could not resolve user id after signUp");
  }

  const { error: confirmError } = await admin.auth.admin.updateUserById(userId, {
    email_confirm: true,
    password: ADMIN_PASSWORD,
  });
  if (confirmError) throw confirmError;

  console.log(`Created user via signUp: ${ADMIN_EMAIL}`);
  return userId;
}

async function ensureAdmin() {
  console.log("Creating admin account...\n");

  const userId = await createOrUpdateUser();

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: userId,
      email: ADMIN_EMAIL,
      full_name: ADMIN_NAME,
      role: "ADMIN",
      is_active: true,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    logStepError("profiles upsert", profileError);
    throw profileError;
  }
  console.log("Profile set to ADMIN role.");

  const anon = createClient(url, anonKey);
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  if (signInError) {
    logStepError("signIn", signInError);
    throw signInError;
  }

  console.log("\n✅ Admin account ready");
  console.log("─────────────────────────────");
  console.log(`Email:    ${ADMIN_EMAIL}`);
  console.log(`Password: ${ADMIN_PASSWORD}`);
  console.log(`User ID:  ${signIn.user.id}`);
  console.log("─────────────────────────────");
  console.log("\nSign in at: http://localhost:3000/login");
}

ensureAdmin().catch((err) => {
  console.error("\nFailed:", err?.message ?? err);
  process.exit(1);
});
