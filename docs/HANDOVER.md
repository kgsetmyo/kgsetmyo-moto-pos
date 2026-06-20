# Moto POS — Project Handover Summary

**Product:** Cloud-based Point of Sale & Inventory Management for a motorcycle spare parts shop  
**Repository:** `moto-pos`  
**Status:** Production-ready (pending Vercel deploy + GitHub secrets for CI)  
**Last verified:** Migration `009` applied — FIFO partial index + `FOR UPDATE` row locks confirmed

---

## 1. Tech Stack

| Layer | Technology | Version / Notes |
|-------|------------|-----------------|
| Framework | Next.js (App Router) | 16.2.9 |
| UI | React + Joy UI (MUI) | React 19, Joy 5 beta |
| Styling | Emotion, Tailwind 4 | Joy primary; Tailwind for utilities |
| Data fetching (client) | SWR | Cached API reads, skeleton loaders |
| Validation | Zod | API request bodies |
| Auth | Supabase Auth + `@supabase/ssr` | Cookie sessions |
| Database | Supabase PostgreSQL | REST + RPC from server |
| Storage | Supabase Storage | `slips` bucket (mobile banking) |
| Printing | react-to-print | 80mm thermal receipts |
| Barcodes | jsbarcode | Label generation |
| Hosting | Vercel (target) | Stateless API routes |
| CI | GitHub Actions | `.github/workflows/test-audit.yml` |

**Runtime pattern:** Next.js API routes call `createAdminClient()` (service role) → Supabase HTTPS API. Direct Postgres (`DATABASE_URL` / `DIRECT_URL`) is used only for migrations and SQL scripts.

---

## 2. Application Architecture

```
src/
  app/(app)/          # Authenticated pages (dashboard, pos, inventory, …)
  app/api/            # 24 REST route handlers
  lib/data/           # Domain logic (sales, products, customers, reports)
  lib/schemas/        # Zod schemas
  lib/auth.ts         # requireProfile(), role guards
  components/         # Joy UI panels, POS cart, skeletons
scripts/              # Smoke, security, migration, seed, load-test tools
supabase/migrations/  # Numbered SQL (001–009) + optional_bundle.sql
```

**Key flows:**
- **Checkout:** `POST /api/sales` → `createSaleWithFifo()` → RPC `create_sale_with_fifo`
- **Void:** `POST /api/sales/[id]/void` → RPC `void_sale_with_fifo`
- **Credit payment:** `POST /api/customers/[id]/ledger` → RPC `record_credit_payment`
- **Search:** `GET /api/products` with ILIKE + bike compatibility filters

**Middleware:** Page routes only (`/pos`, `/dashboard`, …). API routes authenticate per-handler via `requireProfile()`.

---

## 3. Database Architecture

### 3.1 Core entities

| Table | Purpose |
|-------|---------|
| `profiles` | Extends `auth.users` — `ADMIN` / `CASHIER` roles |
| `brands`, `categories`, `products` | SKU catalog (unique SKU, optional barcode) |
| `bike_brands`, `bike_models`, `product_compatibilities` | Compatibility matrix (brand → model → year) |
| `inventory_batches` | FIFO batches (cost, sell price, qty remaining) |
| `sales`, `sale_line_items` | Transactions |
| `sale_batch_allocations` | Immutable COGS audit trail per line |
| `payments` | Cash, mobile banking, credit |
| `customers`, `credit_ledger_entries` | Accounts receivable (အကြွေး) |
| `daily_closes` | Z-report / business day lock |
| `inventory_adjustments` | Stock adjust audit log |
| `expenses` | Operating expenses for P&L reports |

### 3.2 FIFO inventory

1. Stock received → new row in `inventory_batches` with `quantity_remaining`.
2. Sale → `create_sale_with_fifo` selects oldest batches (`ORDER BY received_at ASC`) with **`FOR UPDATE`** row locks.
3. Allocations recorded in `sale_batch_allocations`; `sales.total_cogs` and `gross_profit` computed atomically.
4. Void → `void_sale_with_fifo` restores batch quantities and reverses credit ledger.

### 3.3 Production hardening (migration 009)

```sql
CREATE INDEX idx_inventory_batches_fifo_active
  ON inventory_batches (product_id, received_at ASC, created_at ASC)
  WHERE quantity_remaining > 0;
```

- Prevents oversell on hot SKUs via `FOR UPDATE` in checkout loop.
- Credit limit enforced before sale insert; daily close blocks new sales.

### 3.4 PostgreSQL RPCs (service_role only)

| Function | Purpose |
|----------|---------|
| `create_sale_with_fifo` | Atomic checkout + FIFO + payments + credit ledger |
| `void_sale_with_fifo` | Reverse sale, restore stock, adjust credit |
| `record_credit_payment` | Customer payment against balance |
| `next_invoice_number()` | Sequential invoice IDs |

### 3.5 Migrations (apply in order)

| File | Required | Description |
|------|----------|-------------|
| `001_initial_schema.sql` | Yes | Tables, views, RLS, extensions (`pg_trgm`) |
| `002_fix_auth_trigger.sql` | Yes | Profile auto-create on signup |
| `003_create_sale_rpc.sql` | Yes | Checkout RPC + slips storage bucket |
| `004_credit_limit_and_daily_close.sql` | Yes | Credit limits + Z-report close |
| `005–008` | Recommended | Credit payments, adjustments, void RPC, CREDIT enum |
| `009_production_hardening.sql` | Yes (prod) | FIFO index + lock documentation |
| `optional_bundle.sql` | Convenience | Bundles 005–008 for SQL Editor paste |

**Check status:** `npm run migrate:check`

### 3.6 Connection pooler (Supavisor)

| Variable | Port | Use |
|----------|------|-----|
| `DATABASE_URL` | 6543 | Transaction mode — scripts, seeds |
| `DIRECT_URL` | 5432 | Session / direct `db.*.supabase.co` — migrations |

**Windows note:** `scripts/load-env.mjs` forces `.env.local` to override stale shell variables (Node `--env-file` does not).

---

## 4. Security Features

### 4.1 Authentication & authorization

- Supabase Auth with HTTP-only session cookies.
- `requireProfile(['ADMIN'])` on sensitive routes (settings, valuation, imports, migration status).
- Cashiers blocked from: cost prices, Z-reports, inventory valuation, settings PATCH.
- `GET /api/inventory/batches` strips `costPrice` for cashier role.

### 4.2 Data access model

- **RLS enabled** on tables (defense in depth).
- **App uses service role** server-side — authorization enforced in API layer, not per-row RLS policies.
- RPCs granted to `service_role` only; not callable via anon key.

### 4.3 Input hardening

- Zod validation on all mutation endpoints.
- Product search sanitization (PostgREST filter injection / 5xx prevention).
- Oversell returns 409; credit limit exceeded returns error from RPC.
- Mobile slip upload: auth required, 5MB cap (MIME allowlist recommended for production).

### 4.4 Automated security tests

| Script | Command | Checks |
|--------|---------|--------|
| Security audit | `npm run test:security` | 401/403 guards, SQL-like search, cost leak |
| Smoke tests | `npm run test:smoke` | 53 integration flows |
| Full audit gate | `npm run test:audit` | lint + tsc + smoke + security |

### 4.5 Known production follow-ups

- Add API rate limiting (Vercel / Upstash).
- Signed URLs for slip storage instead of public bucket.
- Remove or restrict `ADMIN_EMAIL` auto-promote in `src/lib/auth.ts` for production.
- Per-role RLS as secondary defense (optional).

---

## 5. Roles & Test Accounts

| Role | Email | Capabilities |
|------|-------|--------------|
| Admin | `admin@moto-parts.shop` | Full access, reports, costs, settings |
| Cashier | `cashier@moto-parts.shop` | POS, sales, customers; no admin APIs |

Create users: `npm run admin:create` / `npm run cashier:create`

---

## 6. NPM Scripts (developer reference)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local dev server |
| `npm run build` / `start` | Production build |
| `npm run test:audit` | CI-quality gate |
| `npm run test:all` | lint + tsc + build + smoke |
| `npm run seed` | Seed demo product + stock |
| `npm run migrate:009` | Apply production hardening |
| `npm run verify:009` | Confirm index + FOR UPDATE |
| `npm run test:checkout-spike` | Concurrent write load test |
| `npm run teardown:load-test:api` | Void tagged load-test sales |

---

## 7. Deployment Checklist

1. Apply all migrations (`001`–`009`) on Supabase.
2. Set Vercel env vars per `.env.production.example` and `docs/VERCEL_ENV.md`.
3. Add Supabase auth redirect URLs for production domain.
4. Configure GitHub secrets (see `docs/CI.md`).
5. Run `npm run test:audit` locally before merge.
6. Post-deploy: login, checkout (cash/mobile/credit), void, slip upload.

**Docs:** `docs/DEPLOYMENT.md`, `docs/LOCAL_SETUP.md`, `docs/CI.md`

---

## 8. Performance Baseline (local staging)

| Endpoint / scenario | p95 | Error rate |
|---------------------|-----|------------|
| Product search (read) | ~490ms | 0% |
| Dashboard (read) | ~1050ms | 0% |
| Checkout spike (45 concurrent writes) | ~1121ms | 0% |

FIFO locks prevent negative stock under concurrent checkout; teardown restores inventory to pre-test levels.

---

## 9. Out of Scope (deferred)

- Offline queue / PWA sync
- SMS credit reminders
- PIN-gated discounts
- PDF report export
- Per-role Supabase RLS (route guards in place)
- Prisma removal (legacy in package.json; Supabase is primary)

---

## 10. Handover contacts & artifacts

| Artifact | Path |
|----------|------|
| This document | `docs/HANDOVER.md` |
| Implementation history | `docs/IMPLEMENTATION_PLAN.md` |
| CI / GitHub Actions | `docs/CI.md` |
| k6 load tests | `k6/stress-pos.js` |
| Load test cleanup SQL | `scripts/teardown-load-test.sql` |

**Migration 009 verification (final):**
```
✅ idx_inventory_batches_fifo_active
✅ create_sale_with_fifo FOR UPDATE confirmed
```

---

*Document generated for developer onboarding. Update this file when schema or deployment process changes.*
