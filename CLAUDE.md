# Moto POS — Claude Code Guide

See also [AGENTS.md](./AGENTS.md) for shared agent rules.

Cloud Web POS + FIFO inventory + B2C storefront for Myanmar motorcycle spare parts shops.

**Stack:** Next.js 16 · Supabase (Auth + Postgres) · Joy UI · SWR

## Commands

```bash
npm run dev              # http://localhost:3000
npm run build
npm run lint
npx tsc --noEmit
npm run test:audit       # lint + tsc + smoke + security (dev server required)
npm run seed             # upserts SP-CLICK-001 + 50 units stock
npm run admin:create     # create admin from ADMIN_EMAIL / ADMIN_PASSWORD
npm run cashier:create   # create cashier from CASHIER_EMAIL / CASHIER_PASSWORD
```

Windows smoke tests (TLS workaround):

```powershell
$env:SMOKE_INSECURE_TLS=1; npm run test:smoke
$env:SMOKE_INSECURE_TLS=1; npm run test:audit
```

## Environment

- Copy `.env.example` → `.env.local` (never commit secrets).
- Scripts use `node --env-file=.env.local`; `scripts/load-env.mjs` skips keys already in `process.env` (CI-safe).
- `ADMIN_EMAIL` in env determines admin role — see `src/lib/auth.ts`. No hardcoded credentials.

## Architecture

```text
Browser (Joy UI) → Next.js API routes → Supabase Postgres
                         ↓
              create_sale_with_fifo RPC (FIFO checkout)
              create_web_order_with_fifo RPC (B2C)
              void_sale_with_fifo / record_credit_payment RPCs
```

| Concern | Location |
| ------- | -------- |
| Page auth redirects | `src/proxy.ts` — validates Supabase JWT from cookies (exp + optional `SUPABASE_JWT_SECRET` signature) |
| API auth | `requireProfile()` per route (same JWT validation via `session.ts`) |
| Data layer | `src/lib/data/*` (service role client) |
| Staff UI | `src/app/(app)/` |
| Storefront | `src/app/(storefront)/` |
| Migrations | `supabase/migrations/001`–`011` via Supabase SQL Editor |

## Conventions

- Joy UI (`@mui/joy/*`) for UI; `@base-ui/react` if needed — avoid deprecated `@mui/base`.
- Cost prices are admin-only; enforce in API and UI.
- Checkout must go through RPCs — never decrement stock in application code alone.
- CI (`.github/workflows/test-audit.yml`) seeds test data before smoke tests.

## Components

- **Thermal receipt:** `src/components/pos/ThermalReceipt.tsx` — `useReactToPrint` with ref on Joy `<Sheet>`; loads shop name/logo via SWR `/api/settings`.
- **Print pattern:** Same as `src/components/reports/ZReportPrint.tsx`.

## Docs

- [README.md](./README.md)
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- [docs/CI.md](./docs/CI.md)
- [docs/HANDOVER.md](./docs/HANDOVER.md)
