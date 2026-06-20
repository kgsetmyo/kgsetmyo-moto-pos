/**
 * Resolve a working Supabase Postgres connection string.
 * Tries DIRECT_URL / DATABASE_URL, then scans common pooler hosts.
 */
import pg from "pg";
import { loadEnvLocal } from "./load-env.mjs";

loadEnvLocal();

const MIGRATION_FILES = [
  "008_payment_method_credit.sql",
  "005_record_credit_payment.sql",
  "006_inventory_adjustments.sql",
  "007_void_sale_rpc.sql",
];

export { MIGRATION_FILES };

function tlsInsecure() {
  if (process.env.SMOKE_INSECURE_TLS === "1") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
}

function parseProjectRef(connectionString) {
  const fromUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
    /https:\/\/([^.]+)\.supabase\.co/
  )?.[1];
  if (fromUrl) return fromUrl;
  const match = connectionString?.match(/postgres\.([^:]+):/);
  return match?.[1] ?? null;
}

function parsePassword(connectionString) {
  if (!connectionString) return null;
  const match = connectionString.match(/postgres(?:\.[^:]+)?:([^@]+)@/);
  return match?.[1] ?? null;
}

function directDbUrl(ref, password) {
  return `postgresql://postgres:${password}@db.${ref}.supabase.co:5432/postgres?sslmode=require`;
}

function sessionUrl(ref, password, host, port = 5432) {
  return `postgresql://postgres.${ref}:${password}@${host}:${port}/postgres?sslmode=require`;
}

function candidateUrls() {
  const direct = process.env.DIRECT_URL;
  const database = process.env.DATABASE_URL;
  const ref = parseProjectRef(direct ?? database);
  const password =
    parsePassword(direct) ?? parsePassword(database);

  const urls = [];
  if (direct) urls.push(direct);
  if (database) urls.push(database);

  if (ref && password) {
    urls.push(directDbUrl(ref, password));
    urls.push(sessionUrl(ref, password, `aws-0-ap-southeast-1.pooler.supabase.com`, 5432));
    urls.push(sessionUrl(ref, password, `aws-1-ap-northeast-2.pooler.supabase.com`, 5432));
    urls.push(sessionUrl(ref, password, `aws-1-ap-northeast-2.pooler.supabase.com`, 6543));
  }

  if (password && ref) {
    const regions = [
      "ap-southeast-1",
      "ap-southeast-2",
      "ap-northeast-1",
      "ap-northeast-2",
      "ap-south-1",
      "us-east-1",
      "us-west-1",
      "eu-west-1",
      "eu-central-1",
    ];
    for (const region of regions) {
      for (const prefix of ["aws-0", "aws-1"]) {
        urls.push(sessionUrl(ref, password, `${prefix}-${region}.pooler.supabase.com`, 5432));
        urls.push(sessionUrl(ref, password, `${prefix}-${region}.pooler.supabase.com`, 6543));
      }
    }
  }

  return [...new Set(urls.filter(Boolean))];
}

export async function connectPostgres() {
  tlsInsecure();
  const urls = candidateUrls();
  let lastError = null;

  for (const connectionString of urls) {
    const client = new pg.Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });
    try {
      await client.connect();
      await client.query("SELECT 1");
      return { client, connectionString };
    } catch (err) {
      lastError = err;
      try {
        await client.end();
      } catch {
        /* ignore */
      }
    }
  }

  throw lastError ?? new Error("No Postgres connection candidates");
}
