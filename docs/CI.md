# CI/CD quality gate

Block merges to `main` until the GitHub **Test Audit** workflow passes.

## What runs locally vs CI

**Local `npm run test:audit`** (fast feedback without build):

```bash
npm run lint          # ESLint
npx tsc --noEmit      # TypeScript strict check
npm run test:smoke    # Integration flows (needs running app + Supabase)
npm run test:security # Auth, role separation, injection probes
```

**CI workflow** (`.github/workflows/test-audit.yml`) runs a stricter sequence:

1. `npm ci`
2. Lint + typecheck
3. **Production build** (`npm run build`)
4. **Seed** staging data (`npm run seed`) — ensures `SP-CLICK-001` stock for smoke tests
5. Start server → wait-on → smoke + security
6. **Teardown** (`npm run test:ci:teardown`, `if: always()`) — void tagged sales, deactivate stray customers

Optional heavier checks (not in CI):

```bash
npm run test:stress   # Read-load performance (manual / nightly)
```

## GitHub Actions workflow

The live workflow adds:

- **`concurrency`** — cancels overlapping runs on the same branch
- **`CI_SMOKE_NOTE` / `GITHUB_RUN_ID`** — smoke sales are tagged for teardown
- **Best-effort teardown** — never fails the job; cleans staging after each run

```yaml
name: Test Audit

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: test-audit-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  audit:
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      DIRECT_URL: ${{ secrets.DIRECT_URL }}
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      ADMIN_EMAIL: ${{ secrets.ADMIN_EMAIL }}
      ADMIN_PASSWORD: ${{ secrets.ADMIN_PASSWORD }}
      CASHIER_EMAIL: ${{ secrets.CASHIER_EMAIL }}
      CASHIER_PASSWORD: ${{ secrets.CASHIER_PASSWORD }}
      TEST_BASE_URL: http://localhost:3000
      SMOKE_INSECURE_TLS: "1"
      CI_SMOKE_NOTE: CI smoke test transaction
      GITHUB_RUN_ID: ${{ github.run_id }}

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
      - run: npm ci
      - name: Create .env.local from secrets
        run: |
          {
            echo "DATABASE_URL=$DATABASE_URL"
            echo "DIRECT_URL=$DIRECT_URL"
            echo "NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL"
            echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY"
            echo "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY"
            echo "ADMIN_EMAIL=$ADMIN_EMAIL"
            echo "ADMIN_PASSWORD=$ADMIN_PASSWORD"
            echo "CASHIER_EMAIL=$CASHIER_EMAIL"
            echo "CASHIER_PASSWORD=$CASHIER_PASSWORD"
            echo "TEST_BASE_URL=$TEST_BASE_URL"
            echo "SMOKE_INSECURE_TLS=$SMOKE_INSECURE_TLS"
            echo "CI_SMOKE_NOTE=$CI_SMOKE_NOTE"
            echo "GITHUB_RUN_ID=$GITHUB_RUN_ID"
          } > .env.local
      - name: Lint and typecheck
        run: npm run lint && npx tsc --noEmit
      - name: Build
        run: npm run build
      - name: Seed test data
        run: npm run seed
      - name: Start server
        run: npm run start &
      - name: Wait for server
        run: npx wait-on http://localhost:3000 --timeout 60000
      - name: Smoke + security
        run: npm run test:smoke && npm run test:security
      - name: Teardown CI artifacts
        if: always()
        run: npm run test:ci:teardown
```

### Required GitHub secrets

| Secret | Purpose |
|--------|---------|
| `DATABASE_URL` | Prisma / migrations (staging) |
| `DIRECT_URL` | Session pooler for SQL scripts |
| `NEXT_PUBLIC_SUPABASE_URL` | Staging Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server tests + teardown |
| `SUPABASE_JWT_SECRET` | JWT signature verification for session hardening (recommended) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin test account |
| `CASHIER_EMAIL` / `CASHIER_PASSWORD` | Cashier test account |

Use a **staging** Supabase project — never production data.

### Branch protection

GitHub → Repository → **Settings → Branches → Branch protection rules**:

1. Require status check **Test Audit / audit**
2. Require branches to be up to date before merging

## CI teardown

Smoke tests tag completed sales with `CI smoke test transaction (run {id})`. After each run, `scripts/ci-teardown.mjs`:

- Voids matching **COMPLETED** in-store sales
- Deactivates active customers named `Smoke Test …` or `Credit …`
- Removes orphan `SmokeBrand…` bike brands

Teardown is **best-effort** (exit 0) so a cleanup glitch does not fail a green test run.

Local manual cleanup:

```bash
npm run test:ci:teardown
```

## Vercel deployment gate

Vercel does not run integration tests by default. Options:

### Option A — GitHub required check (recommended)

Enable branch protection with the workflow above. Vercel deploys after merge; tests block the merge.

### Option B — Vercel ignored build step

Project → **Settings → Git** → **Ignored Build Step**:

```bash
if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then exit 1; else exit 0; fi
```

Deploy `main` only from merges that already passed GitHub Actions.

### Option C — Preview smoke against staging URL

Set `TEST_BASE_URL` to the Vercel preview URL in a post-deploy GitHub Action or manual `npm run test:smoke`.

## Load test teardown

After k6 or concurrent checkout tests on staging, tag sales with:

```text
notes: 'Load test automated transaction'
```

Then run in Supabase SQL Editor:

```bash
# Session pooler — not transaction mode
psql "$DIRECT_URL" -f scripts/teardown-load-test.sql
```

Or: `npm run teardown:load-test:api`

## Database migration 009

Before production load tests, apply FIFO hardening:

```text
supabase/migrations/009_production_hardening.sql
```

Paste in Supabase SQL Editor or run via `npm run migrate:via-cli` with `DIRECT_URL` (session mode).
