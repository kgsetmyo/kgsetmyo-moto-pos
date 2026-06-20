/**
 * Find working Supabase pooler region from env password.
 * Usage: SMOKE_INSECURE_TLS=1 node --env-file=.env.local scripts/test-db.mjs
 */
import { connectPostgres } from "./db-connect.mjs";

try {
  const { client, connectionString } = await connectPostgres();
  console.log("✅ Postgres connection works");
  console.log(`\nDIRECT_URL=${connectionString}`);
  await client.end();
} catch (err) {
  console.error("❌ No pooler connection worked:", err.message);
  console.error("\nCopy the Session pooler URI from Supabase Dashboard → Database → Connect.");
  console.error("Or paste supabase/migrations/optional_bundle.sql in the SQL Editor.");
  process.exit(1);
}
