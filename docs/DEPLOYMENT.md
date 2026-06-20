# Deploy Moto POS to Vercel

## Prerequisites

- [GitHub](https://github.com) account with this repo pushed
- [Vercel](https://vercel.com) account (free tier works)
- Supabase project with migrations applied (`001`–`004` required; `005`–`009` recommended; `010`–`011` for analytics + storefront)

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

| Variable                        | Value                     | Notes                                   |
| ------------------------------- | ------------------------- | --------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://xxx.supabase.co` | Supabase → Settings → API               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...`                  | Public anon key                         |
| `SUPABASE_SERVICE_ROLE_KEY`     | `eyJ...`                  | **Secret** — server only                |
| `ADMIN_EMAIL`                   | `admin@example.com`       | Must match Supabase admin user email    |
| `DATABASE_URL`                  | Pooler URI port **6543**  | Transaction mode — scripts/seeds        |
| `DIRECT_URL`                    | Pooler URI port **5432**  | Session mode — migrations, teardown SQL |

Copy the full production layout from `.env.production.example`. The Next.js runtime uses the Supabase HTTPS API; `DATABASE_URL` / `DIRECT_URL` are for CLI scripts and SQL tooling only.

Apply to: **Production**, **Preview**, **Development**.

## 4. GitHub Actions secrets (CI)

For the `test-audit` workflow (`.github/workflows/test-audit.yml`), add these in GitHub → **Settings → Secrets and variables → Actions**:

| Secret                          | Purpose                    |
| ------------------------------- | -------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Staging Supabase project   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key            |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-side tests          |
| `ADMIN_EMAIL`                   | Test admin account         |
| `ADMIN_PASSWORD`                | Test admin password        |
| `CASHIER_EMAIL`                 | Test cashier account       |
| `CASHIER_PASSWORD`              | Test cashier password      |

The workflow creates `.env.local` from these secrets before running `npm run build` and `npm run test:audit`. Use a **staging** Supabase project — never production data.

See [CI.md](./CI.md) for branch protection setup.

## 5. Deploy

Click **Deploy**. Vercel runs `npm run build` automatically.

Your app will be live at: `https://your-project.vercel.app`

## 6. Supabase auth redirect URLs

In **Supabase → Authentication → URL Configuration**, add:

- **Site URL:** `https://your-project.vercel.app`
- **Redirect URLs:** `https://your-project.vercel.app/**`

## 7. Post-deploy checklist

```bash
npm run migrate:check
# Apply any pending migrations in Supabase SQL Editor:
#   009_production_hardening.sql
#   010_analytics_mv.sql
#   011_omnichannel.sql

npm run test:audit   # lint + tsc + smoke + security (dev server required locally)
```

- [ ] Login works on production URL
- [ ] POS checkout (cash, mobile, credit, split) completes
- [ ] Credit payment and void sale work
- [ ] Mobile slip upload works (`slips` bucket from migration 003)
- [ ] Admin vs Cashier roles behave correctly (cashier cannot see cost prices)
- [ ] `/shop` storefront loads and checkout creates web orders
- [ ] `/web-orders` staff panel receives Realtime alerts (enable Realtime on `sales` in Supabase)
- [ ] Analytics dashboard loads (enable pg_cron for MV refresh if using migration 010)

## 8. Custom domain (optional)

Vercel → Project → **Domains** → add your shop domain (e.g. `pos.yourshop.com`).

Update Supabase redirect URLs to match.

## Troubleshooting

| Issue                  | Fix                                                                  |
| ---------------------- | -------------------------------------------------------------------- |
| Login fails on Vercel  | Add production URL to Supabase redirect URLs; set `ADMIN_EMAIL`      |
| Checkout 503           | Run `003_create_sale_rpc.sql` in Supabase                            |
| Credit sales fail      | Run `008_payment_method_credit.sql` or full `optional_bundle.sql`    |
| Void slow / errors     | Run `007_void_sale_rpc.sql`                                          |
| API 500 on dashboard   | Check `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel                   |
| Build fails            | Run `npm run build` locally first to catch TypeScript errors         |
| CI smoke tests fail    | Verify all 8 GitHub secrets are set; check staging auth users exist  |

## Redeploy after changes

Push to `main` — Vercel auto-deploys. Or run:

```bash
npx vercel --prod
```
