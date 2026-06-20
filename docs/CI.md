# CI/CD quality gate

Block merges to `main` until `npm run test:audit` passes.

## What `test:audit` runs

```bash
npm run lint          # ESLint
npx tsc --noEmit      # TypeScript strict check
npm run test:smoke    # 53 integration flows (needs running app + Supabase)
npm run test:security # Auth, role separation, injection probes
```

Optional heavier checks (not in `test:audit`):

```bash
npm run build         # Production build (included in test:all)
npm run test:stress   # Read-load performance (manual / nightly)
```

## GitHub Actions (blocking PR check)

Create `.github/workflows/test-audit.yml`:

```yaml
name: Test Audit

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    env:
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      ADMIN_EMAIL: ${{ secrets.ADMIN_EMAIL }}
      ADMIN_PASSWORD: ${{ secrets.ADMIN_PASSWORD }}
      CASHIER_EMAIL: ${{ secrets.CASHIER_EMAIL }}
      CASHIER_PASSWORD: ${{ secrets.CASHIER_PASSWORD }}
      TEST_BASE_URL: http://localhost:3000
      SMOKE_INSECURE_TLS: "1"

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm

      - run: npm ci

      - name: Lint and typecheck
        run: npm run lint && npx tsc --noEmit

      - name: Build
        run: npm run build

      - name: Start server
        run: npm run start &

      - name: Wait for server
        run: npx wait-on http://localhost:3000 --timeout 60000

      - name: Smoke + security
        run: npm run test:smoke && npm run test:security
```

### Required GitHub secrets

| Secret | Purpose |
|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Staging Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server tests |
| `ADMIN_PASSWORD` / `CASHIER_PASSWORD` | Test accounts |

Use a **staging** Supabase project — never production data.

### Branch protection

GitHub → Repository → **Settings → Branches → Branch protection rules**:

1. Require status check **Test Audit / audit**
2. Require branches to be up to date before merging

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

## Database migration 009

Before production load tests, apply FIFO hardening:

```text
supabase/migrations/009_production_hardening.sql
```

Paste in Supabase SQL Editor or run via `npm run migrate:via-cli` with `DIRECT_URL` (session mode).
