# Moto POS — Motorcycle Spare Parts Shop

Cloud Web POS + FIFO inventory + B2C storefront for Myanmar motorcycle spare parts shops.

**Stack:** Next.js 16 · Supabase (Auth + Postgres) · Joy UI · SWR

## Quick Start

```bash
cd moto-pos
cp .env.example .env.local
# Fill in Supabase URL, anon key, service role key, and account credentials (ADMIN_EMAIL, etc.)

# Run ALL migrations in Supabase SQL Editor (in order):
#   supabase/migrations/001_initial_schema.sql
#   supabase/migrations/002_fix_auth_trigger.sql
#   supabase/migrations/003_create_sale_rpc.sql
#   supabase/migrations/004_credit_limit_and_daily_close.sql
#   supabase/migrations/005_record_credit_payment.sql  (optional, recommended)
#   supabase/migrations/006_inventory_adjustments.sql  (optional, audit log)
#   supabase/migrations/007_void_sale_rpc.sql            (optional, recommended)
#   supabase/migrations/008_payment_method_credit.sql  (if credit sales fail)
#   supabase/migrations/009_production_hardening.sql   (recommended for production)
#   supabase/migrations/010_analytics_mv.sql           (analytics dashboard)
#   supabase/migrations/011_omnichannel.sql            (B2C storefront + web orders)

npm run admin:create   # uses ADMIN_EMAIL / ADMIN_PASSWORD from .env.local
npm run cashier:create # uses CASHIER_EMAIL / CASHIER_PASSWORD from .env.local
npm run seed           # sample product + stock
npm run dev            # http://localhost:3000
```

Verify:

```powershell
npm run migrate:check
npm run migrate:bundle   # writes optional_bundle.sql — paste in Supabase SQL Editor
$env:SMOKE_INSECURE_TLS=1; npm run test:smoke
$env:SMOKE_INSECURE_TLS=1; npm run test:audit
```

## Test Accounts

Set credentials in `.env.local` (see `.env.example`):

| Variable                             | Purpose                         |
| ------------------------------------ | ------------------------------- |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD`     | Admin login & smoke tests       |
| `CASHIER_EMAIL` / `CASHIER_PASSWORD` | Cashier login & role tests      |

Create accounts with `npm run admin:create` and `npm run cashier:create`.

## Architecture

```text
Browser (Joy UI) → Next.js API routes → Supabase Postgres
                         ↓
              create_sale_with_fifo RPC (FIFO checkout)
              create_web_order_with_fifo RPC (B2C checkout)
              record_credit_payment RPC (atomic credit collection)
              void_sale_with_fifo RPC (sale void + stock restore)
```

Auth is enforced in `src/proxy.ts` (Next.js 16 proxy convention) and API route guards via `requireProfile()`.

## Features

| Module                              | Status |
| ----------------------------------- | ------ |
| FIFO batch inventory & COGS         | ✅     |
| Bike compatibility matrix           | ✅     |
| POS (barcode, split payments)       | ✅     |
| Thermal 80mm receipts               | ✅     |
| Sales history, reprint, void        | ✅     |
| Customers & credit ledger           | ✅     |
| Stock adjustment + audit log        | ✅     |
| Z-Report & date-range P&L           | ✅     |
| Analytics dashboard (Recharts)      | ✅     |
| B2C storefront + click & collect    | ✅     |
| Web orders panel (staff + Realtime) | ✅     |
| Role-based auth                     | ✅     |

## Scripts

| Command                  | Purpose                                               |
| ------------------------ | ----------------------------------------------------- |
| `npm run dev`            | Dev server (TLS workaround on Windows)                |
| `npm run build`          | Production build                                      |
| `npm run lint`           | ESLint                                                |
| `npm run test:audit`     | Lint + typecheck + smoke + security (server required) |
| `npm run test:all`       | Lint + typecheck + build + smoke                      |
| `npm run migrate:check`  | Verify RPCs installed                                   |
| `npm run migrate:010`    | Apply analytics migration via script                  |
| `npm run migrate:011`    | Apply omnichannel migration via script                |
| `npm run auth:check`     | List Supabase auth users                                |
| `npm run seed`           | Seed sample product                                   |
| `npm run admin:create`   | Create admin user                                     |
| `npm run cashier:create` | Create cashier user                                   |

## Project Structure

```text
moto-pos/
├── supabase/migrations/     # SQL — run in Supabase SQL Editor
├── scripts/                 # Admin, seed, smoke tests
├── src/
│   ├── app/(app)/           # Staff: dashboard, POS, inventory, analytics
│   ├── app/(storefront)/    # Public shop, cart, checkout
│   ├── app/api/             # REST API routes
│   ├── components/          # UI components
│   ├── lib/data/            # Supabase data layer
│   └── proxy.ts             # Auth redirects (Next.js 16)
└── docs/
    ├── LOCAL_SETUP.md
    ├── DEPLOYMENT.md
    └── CI.md
```

## POS Keyboard Shortcuts

| Key | Action           |
| --- | ---------------- |
| F1  | Focus search     |
| F2  | Cash payment     |
| F3  | Mobile banking   |
| F4  | Credit payment   |
| F9  | Checkout         |

## Docs

- [Local Setup](./docs/LOCAL_SETUP.md)
- [Deployment (Vercel)](./docs/DEPLOYMENT.md)
- [CI/CD quality gate](./docs/CI.md)
- [Implementation Plan](./docs/IMPLEMENTATION_PLAN.md)

## Windows Notes

If Node cannot reach Supabase (SSL errors), the dev script sets `NODE_TLS_REJECT_UNAUTHORIZED=0` in development. For smoke tests:

```powershell
$env:SMOKE_INSECURE_TLS=1; npm run test:smoke
```
