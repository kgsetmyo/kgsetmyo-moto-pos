/**
 * Deactivate and remove legacy auth users (handles FK constraints on profiles).
 * Usage: SMOKE_INSECURE_TLS=1 node --env-file=.env.local scripts/remove-auth-users.mjs admin@moto-parts.shop
 */
import { createClient } from "@supabase/supabase-js";

if (process.env.SMOKE_INSECURE_TLS === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const emails = process.argv.slice(2).map((e) => e.trim().toLowerCase()).filter(Boolean);
if (!emails.length) {
  console.error("Usage: SMOKE_INSECURE_TLS=1 npm run auth:cleanup -- email@example.com");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
if (error) {
  console.error("Failed to list users:", error.message);
  process.exit(1);
}

for (const email of emails) {
  const user = data.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) {
    console.log(`⏭️  ${email} — not found`);
    continue;
  }

  await admin.from("profiles").update({ is_active: false }).eq("id", user.id);

  const { error: banErr } = await admin.auth.admin.updateUserById(user.id, {
    ban_duration: "876000h",
  });
  if (banErr) {
    console.warn(`⚠️  ban ${email}:`, banErr.message);
  } else {
    console.log(`🔒 Banned ${email} (cannot sign in)`);
  }

  const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id);
  if (deleteErr) {
    console.log(
      `⚠️  ${email} — auth delete blocked (linked sales/inventory). User is banned and profile deactivated.`
    );
  } else {
    console.log(`✅ Deleted auth user ${email}`);
  }
}

console.log("\nRun: SMOKE_INSECURE_TLS=1 npm run auth:check");
