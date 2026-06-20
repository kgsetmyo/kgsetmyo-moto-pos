# CI/CD quality gate

Block merges to `main` until the GitHub **Test Audit** workflow passes. Complete [BRANCH_PROTECTION.md](./BRANCH_PROTECTION.md) in GitHub settings after the first green run.

## What runs locally vs CI

**Local `npm run test:audit`** (fast feedback without build):

```bash
npm run lint          # ESLint
npx tsc --noEmit      # TypeScript strict check
npm run test:smoke    # Integration flows (needs running app + Supabase)
npm run test:security # Auth, role separation, injection probes
```

**Local dependency audit** (same threshold as CI):

```bash
npm run audit:ci      # fails on high/critical CVEs only
```

**CI workflow** (`.github/workflows/test-audit.yml`):

1. `npm ci`
2. **`npm run audit:ci`** — block high/critical vulnerabilities
3. Lint + typecheck
4. **Next.js build cache** restore → production build
5. Seed staging data → start server → smoke + security
6. Teardown (`if: always()`)

Optional heavier checks (not in CI):

```bash
npm run test:stress   # Read-load performance (manual / nightly)
```

## Hardening (Track D)

| Control | Implementation |
|---------|----------------|
| Pinned GitHub Actions | Commit SHAs in workflow (not `@v4` tags) |
| Least privilege | `permissions: contents: read` |
| Concurrency | Cancel overlapping runs on same branch |
| Dependency updates | `.github/dependabot.yml` (npm + actions, weekly) |
| CVE gate | `npm run audit:ci` (`--audit-level=high`) |
| Build cache | `actions/cache` for `.next/cache` |
| Pinned `wait-on` | devDependency + `npx --no-install wait-on` |
| Branch protection | Manual checklist → [BRANCH_PROTECTION.md](./BRANCH_PROTECTION.md) |

### Pinned action SHAs

Update when Dependabot opens an actions bump PR, or resolve manually:

```bash
# Example: resolve v4 tag head for actions/checkout
curl -s https://api.github.com/repos/actions/checkout/git/refs/tags/v4 | jq -r .object.sha
```

Current pins (2026-06):

| Action | SHA | Tag |
|--------|-----|-----|
| `actions/checkout` | `34e114876b0b11c390a56381ad16ebd13914f8d5` | v4 |
| `actions/setup-node` | `49933ea5288caeca8642d1e84afbd3f7d6820020` | v4 |
| `actions/cache` | `0057852bfaa89a56745cba8c7296529d2fc39830` | v4 |

### npm audit policy

CI fails on **high** and **critical** advisories. Moderate/low are reported but do not block (e.g. transitive PostCSS via Next until upstream fixes land). Run `npm audit` locally for the full report.

## Required GitHub secrets

| Secret | Purpose |
|--------|---------|
| `DATABASE_URL` | Prisma / migrations (staging) |
| `DIRECT_URL` | Session pooler for SQL scripts |
| `NEXT_PUBLIC_SUPABASE_URL` | Staging Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server tests + teardown |
| `SUPABASE_JWT_SECRET` | JWT signature verification (recommended) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin test account |
| `CASHIER_EMAIL` / `CASHIER_PASSWORD` | Cashier test account |

Use a **staging** Supabase project — never production data.

## CI teardown

Smoke tests tag completed sales with `CI smoke test transaction (run {id})`. After each run, `scripts/ci-teardown.mjs` voids tagged sales, deactivates stray customers, and removes orphan smoke bike brands. Best-effort (exit 0).

```bash
npm run test:ci:teardown
```

## Vercel deployment gate

### Option A — GitHub required check (recommended)

Enable branch protection with **Test Audit / audit**. Vercel deploys after merge; tests block the merge. See [BRANCH_PROTECTION.md](./BRANCH_PROTECTION.md).

### Option B — Vercel ignored build step

Project → **Settings → Git** → **Ignored Build Step**:

```bash
if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then exit 1; else exit 0; fi
```

### Option C — Preview smoke against staging URL

Set `TEST_BASE_URL` to the Vercel preview URL in a post-deploy job or run `npm run test:smoke` manually.

## Load test teardown

Tag sales with `notes: 'Load test automated transaction'`, then:

```bash
psql "$DIRECT_URL" -f scripts/teardown-load-test.sql
# or
npm run teardown:load-test:api
```

## Database migration 009

Before production load tests, apply FIFO hardening in `supabase/migrations/009_production_hardening.sql` via Supabase SQL Editor or `npm run migrate:via-cli`.
