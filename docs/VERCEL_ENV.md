# Vercel environment provisioning

Use `.env.production.example` as the source layout. **Never commit real secrets.**

## Port mapping (required)

| Variable | Port | Pool mode | Purpose |
|----------|------|-----------|---------|
| `DATABASE_URL` | **6543** | Transaction (`pgbouncer=true`) | Scripts, seeds, short mutations |
| `DIRECT_URL` | **5432** | Session | Migrations, teardown SQL, analytics |

The Next.js runtime uses `NEXT_PUBLIC_SUPABASE_*` + `SUPABASE_SERVICE_ROLE_KEY` over HTTPS — not `DATABASE_URL`.

## Option A — Vercel Dashboard

Project → **Settings → Environment Variables** → add each key for **Production**, **Preview**, and **Development**:

1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`
4. `DATABASE_URL` — must contain `:6543/` and `pgbouncer=true`
5. `DIRECT_URL` — must contain `:5432/`
6. `ADMIN_EMAIL` (optional)

Copy values from Supabase → **Settings → Database** (connection strings).

## Option B — Vercel CLI

```bash
npm i -g vercel
vercel link

# Create a local file (gitignored) with real values:
cp .env.production.example .env.production.local
# Edit .env.production.local — fix PROJECT_REF, password, region

# Bash (Git Bash / WSL):
bash scripts/vercel-env-template.sh .env.production.local

# Or set individually (PowerShell — paste real value at prompt):
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add DATABASE_URL production
vercel env add DIRECT_URL production
```

## Verify pooler ports after push

```bash
vercel env pull .env.vercel.check --environment=production
# DATABASE_URL should show :6543
# DIRECT_URL should show :5432
```

## Fix invalid DIRECT_URL

If `migrate:009` fails with `tenant/user postgres.PROJECT_REF not found`:

1. Supabase Dashboard → **Settings → Database**
2. Copy **Session mode** URI (port 5432) → `DIRECT_URL`
3. Copy **Transaction mode** URI (port 6543) → `DATABASE_URL`
4. URL-encode `@` in passwords as `%40`
5. Re-run: `npm run migrate:009 && npm run verify:009`
