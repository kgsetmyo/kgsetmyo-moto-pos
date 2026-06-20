# Moto POS — Motorcycle Spare Parts Shop

Cloud Web POS + FIFO inventory for Myanmar motorcycle spare parts shops.

**Stack:** Next.js 16 · Supabase (Auth + Postgres) · Joy UI · SWR

## Quick Start

```bash
cd moto-pos
cp .env.example .env.local
# Fill in Supabase URL, anon key, service role key

# Run ALL migrations in Supabase SQL Editor (in order):
#   supabase/migrations/001_initial_schema.sql
#   supabase/migrations/002_fix_auth_trigger.sql
#   supabase/migrations/003_create_sale_rpc.sql
#   supabase/migrations/004_credit_limit_and_daily_close.sql
#   supabase/migrations/005_record_credit_payment.sql  (optional, recommended)
#   supabase/migrations/006_inventory_adjustments.sql  (optional, audit log)
#   supabase/migrations/007_void_sale_rpc.sql            (optional, recommended)
#   supabase/migrations/008_payment_method_credit.sql  (if credit sales fail)

npm run admin:create   # admin@moto-parts.shop / admin123456
npm run seed           # sample product + stock
npm run dev            # http://localhost:3000
```

Verify:

```bash
npm run migrate:check
npm run migrate:bundle   # writes optional_bundle.sql — paste in Supabase SQL Editor
$env:SMOKE_INSECURE_TLS=1; npm run test:smoke
$env:SMOKE_INSECURE_TLS=1; npm run migrate:optional   # if DIRECT_URL pooler works
```

## Test Accounts

| Role    | Email                   | Password       |
|---------|-------------------------|----------------|
| Admin   | admin@moto-parts.shop   | admin123456    |
| Cashier | cashier@moto-parts.shop | cashier123456 |

## Architecture

```
Browser (Joy UI) → Next.js API routes → Supabase Postgres
                         ↓
              create_sale_with_fifo RPC (FIFO checkout)
              record_credit_payment RPC (atomic credit collection)
              void_sale_with_fifo RPC (sale void + stock restore)
```

All server data access uses the Supabase service role with route-level `requireProfile()` guards. Cost prices are admin-only (including batch history API).

## Features

| Module | Status |
|--------|--------|
| FIFO batch inventory & COGS | ✅ Postgres RPC |
| Bike compatibility matrix | ✅ Product form + POS filters + inline brand/model add |
| POS (barcode, split payments, discount) | ✅ Cash / Mobile / Credit |
| Thermal 80mm receipts | ✅ Shop logo/name from settings |
| Sales history, reprint, void | ✅ Admin void with FIFO restore |
| Customers & credit ledger | ✅ Limit, payments, deactivate |
| Stock adjustment + audit log | ✅ Admin (migration 006 for history) |
| Z-Report & date-range P&L | ✅ Admin only + print |
| Daily close lock | ✅ Blocks new sales |
| Dashboard (recent sales, low stock) | ✅ |
| Shop settings UI | ✅ Admin |
| Stock valuation & low-stock CSV | ✅ Admin |
| Barcode CODE128 labels | ✅ |
| CSV product import | ✅ Admin |
| CSV report export | ✅ Admin |
| Mobile bottom navigation | ✅ |
| Role-based auth | ✅ Admin / Cashier |

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (TLS workaround on Windows) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run test:smoke` | Full API smoke tests (dev server required) |
| `npm run test:all` | Lint + typecheck + build + smoke |
| `npm run migrate:check` | Verify RPCs installed |
| `npm run migrate:bundle` | Generate `optional_bundle.sql` for SQL Editor |
| `npm run migrate:optional` | Apply migrations 008, 005–007 via Postgres (if pooler works) |
| `npm run seed` | Seed sample product |
| `npm run admin:create` | Create admin user |
| `npm run cashier:create` | Create cashier user |

## Project Structure

```
moto-pos/
├── supabase/migrations/     # SQL — run in Supabase SQL Editor
├── scripts/                 # Admin, seed, smoke tests
├── src/
│   ├── app/(app)/           # Dashboard, POS, Inventory, Customers, Reports, Settings
│   ├── app/api/             # REST API routes
│   ├── components/          # UI components
│   └── lib/data/            # Supabase data layer
└── docs/
    ├── LOCAL_SETUP.md
    └── DEPLOYMENT.md
```

## POS Keyboard Shortcuts

| Key | Action |
|-----|--------|
| F1 | Focus search |
| F2 | Cash payment |
| F3 | Mobile banking |
| F4 | Credit payment |
| F9 | Checkout |

## Docs

- [Local Setup](./docs/LOCAL_SETUP.md)
- [Deployment (Vercel)](./docs/DEPLOYMENT.md)
- [Implementation Plan](./docs/IMPLEMENTATION_PLAN.md)

## Windows Notes

If Node cannot reach Supabase (SSL errors), the dev script sets `NODE_TLS_REJECT_UNAUTHORIZED=0` in development. For smoke tests:

```powershell
$env:SMOKE_INSECURE_TLS=1; npm run test:smoke
```
