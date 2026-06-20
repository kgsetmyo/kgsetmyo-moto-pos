# Deploy Moto POS to Vercel

## Prerequisites

- [GitHub](https://github.com) account with this repo pushed
- [Vercel](https://vercel.com) account (free tier works)
- Supabase project with all migrations applied (`001`–`004` required, `005`–`008` recommended — see `optional_bundle.sql`, `009` for production hardening)

## 1. Push code to GitHub

```bash
cd moto-pos
git init
git add .
git commit -m "Initial Moto POS"
git remote add origin https://github.com/YOUR_USER/moto-pos.git
git push -u origin main
```

> Never commit `.env.local` — it is gitignored.

## 2. Import project in Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. **Framework Preset:** Next.js (auto-detected)
4. **Root Directory:** `moto-pos` (if repo root is parent folder)

## 3. Environment variables

In Vercel → Project → **Settings → Environment Variables**, add:

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | **Secret** — server only |
| `DATABASE_URL` | Pooler URI port **6543** | Transaction mode — scripts/seeds (`pgbouncer=true`) |
| `DIRECT_URL` | Pooler URI port **5432** | Session mode — migrations, teardown SQL |

Copy the full production layout from `.env.production.example`. The Next.js runtime uses the Supabase HTTPS API; `DATABASE_URL` / `DIRECT_URL` are for CLI scripts and SQL tooling only.

Apply to: **Production**, **Preview**, **Development**.

## 4. Deploy

Click **Deploy**. Vercel runs `npm run build` automatically.

Your app will be live at: `https://your-project.vercel.app`

## 5. Supabase auth redirect URLs

In **Supabase → Authentication → URL Configuration**, add:

- **Site URL:** `https://your-project.vercel.app`
- **Redirect URLs:** `https://your-project.vercel.app/**`

## 6. Post-deploy checklist

```bash
npm run migrate:check
# Apply production hardening (FIFO index + row locks):
# Paste supabase/migrations/009_production_hardening.sql in Supabase SQL Editor

npm run test:audit   # lint + tsc + smoke + security (dev server required)
```

See `docs/CI.md` for GitHub Actions and Vercel gate setup.

- [ ] Login works on production URL
- [ ] POS checkout (cash, mobile, credit, split) completes
- [ ] Credit payment and void sale work
- [ ] Mobile slip upload works (`slips` bucket from migration 003)
- [ ] Admin vs Cashier roles behave correctly (cashier cannot see cost prices)

## 7. Custom domain (optional)

Vercel → Project → **Domains** → add your shop domain (e.g. `pos.yourshop.com`).

Update Supabase redirect URLs to match.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Login fails on Vercel | Add production URL to Supabase redirect URLs |
| Checkout 503 | Run `003_create_sale_rpc.sql` in Supabase |
| Credit sales fail | Run `008_payment_method_credit.sql` or full `optional_bundle.sql` |
| Void slow / errors | Run `007_void_sale_rpc.sql` |
| API 500 on dashboard | Check `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel |
| Build fails | Run `npm run build` locally first to catch TypeScript errors |

## Redeploy after changes

Push to `main` — Vercel auto-deploys. Or run:

```bash
npx vercel --prod
```
