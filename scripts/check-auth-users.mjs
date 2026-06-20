/**
 * List auth users in your Supabase project (emails only).
 * Usage: SMOKE_INSECURE_TLS=1 npm run auth:check
 */
import { createClient } from "@supabase/supabase-js";

if (process.env.SMOKE_INSECURE_TLS === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const ref = new URL(url).hostname.split(".")[0];
console.log(`\nSupabase project: ${ref}`);
console.log(`URL: ${url}\n`);

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.listUsers({ perPage: 50 });
if (error) {
  console.error("Failed to list users:", error.message);
  process.exit(1);
}

if (!data.users.length) {
  console.log("No auth users found. Create them in Supabase Dashboard → Authentication → Users");
  process.exit(0);
}

console.log("Auth users:");
for (const u of data.users) {
  console.log(`  • ${u.email ?? "(no email)"}  [${u.id.slice(0, 8)}…]  created ${u.created_at?.slice(0, 10) ?? "?"}`);
}

console.log("\nConfigured in .env.local:");
console.log(`  ADMIN_EMAIL=${process.env.ADMIN_EMAIL ?? "(not set)"}`);
console.log(`  CASHIER_EMAIL=${process.env.CASHIER_EMAIL ?? "(not set)"}`);
console.log("");
