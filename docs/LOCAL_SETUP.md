# Local Setup — Moto POS

## Login (works now)

| Field | Value |
|-------|--------|
| URL | http://localhost:3000/login |
| Email | `admin@moto-parts.shop` |
| Password | `admin123456` |

## Commands

```bash
npm run dev          # Start app
npm run admin:create # Create/reset admin
npm run seed         # Sample spark plug + stock
npm run test:smoke   # Run health checks
npm run db:test      # Find working Postgres pooler URL
```

## Database connection (.env.local)

### Common mistakes

1. **Do not wrap password in `[brackets]`** — those are placeholders in docs only
2. **URL-encode special characters** — `@` in password becomes `%40`
3. **Direct host `db.*.supabase.co` is IPv6-only** — often fails on Windows/local networks

### What works without direct Postgres

APIs now use **Supabase REST** (HTTPS) — dashboard, product search, and seed work without `DATABASE_URL`.

### For Prisma / direct SQL (optional)

Copy the **Session pooler** URI from:

**Supabase Dashboard → Connect → Session pooler**

It looks like:

```
postgresql://postgres.izlvepystykjfhuqcixt:YOUR_PASSWORD@aws-1-REGION.pooler.supabase.com:5432/postgres
```

> Host may be `aws-0` or `aws-1` — copy exactly from your dashboard, do not guess the region.

Set in `.env.local`:

```env
DATABASE_URL=...pooler...:6543/postgres?pgbouncer=true&sslmode=require
DIRECT_URL=...pooler...:5432/postgres?sslmode=require
```

Then: `npm run db:push`

## Installed agent skills

```bash
npx skills add supabase/agent-skills   # already installed
```

Skills live in `.agents/skills/supabase/` and `supabase-postgres-best-practices/`.

## Verified (latest run)

- ✅ **52/52** smoke tests pass (credit sales, void RPC, adjustment audit, role guards)
- ✅ All optional migrations applied (005–008)
- ✅ Production build passes (`npm run build`)
- ✅ Migration status API reports **0 pending**

```powershell
npm run migrate:check
$env:SMOKE_INSECURE_TLS=1; npm run test:smoke
```

## Migrations (run in order in Supabase SQL Editor)

| File | Purpose |
|------|---------|
| `001_initial_schema.sql` | Tables, views, RLS |
| `002_fix_auth_trigger.sql` | Profile auto-create on signup |
| `003_create_sale_rpc.sql` | FIFO checkout + slips bucket |
| `004_credit_limit_and_daily_close.sql` | Credit limits + day-close lock |
| `005_record_credit_payment.sql` | Atomic credit payments (recommended) |
| `006_inventory_adjustments.sql` | Stock write-off audit log (recommended) |
| `007_void_sale_rpc.sql` | Void sales + restore FIFO stock (recommended) |
| `008_payment_method_credit.sql` | Add CREDIT to enum if missing (run before credit sales) |

Verify:

```bash
npm run migrate:check
npm run migrate:bundle
```

Paste `supabase/migrations/optional_bundle.sql` in **Supabase → SQL Editor → Run**, then:

```bash
npm run migrate:check
$env:SMOKE_INSECURE_TLS=1; npm run test:smoke
```

## What's new in the app

| Feature | Page |
|---------|------|
| FIFO checkout (Cash / Mobile / Credit / split) | `/pos` |
| Customer picker for credit sales | POS → Credit |
| Mobile slip upload | POS → Mobile Banking |
| Sales history, reprint, void | `/sales` |
| Receive stock, adjust stock, batch history | `/inventory` |
| Adjustment audit log | `/inventory` (migration 006) |
| Add/edit/deactivate customers + credit ledger | `/customers` |
| Product CRUD + bike compatibility (inline brand/model) | `/inventory` → Products |
| Dashboard (recent sales, low stock) | `/dashboard` |
| Shop settings (name, logo, receipt) | `/settings` |
| Record expenses + Z-report print | `/reports` |
| Stock valuation + low-stock CSV | `/inventory` (Admin) |
| Barcode labels (CODE128) | Product form |

## Roles

| Role | Access |
|------|--------|
| **ADMIN** | Full access — reports, expenses, product CRUD, stock receive (with cost) |
| **CASHIER** | POS, customers, view stock — no reports, no cost prices, no product management |

Create accounts:

```bash
npm run admin:create    # admin@moto-parts.shop / admin123456
npm run cashier:create  # cashier@moto-parts.shop / cashier123456
```
