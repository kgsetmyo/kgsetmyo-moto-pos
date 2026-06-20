# Branch protection checklist

Use this after CI is green on `main`. Settings are in GitHub — not stored in the repo.

**Repository:** `kgsetmyo/kgsetmyo-moto-pos` → **Settings → Branches → Add rule** (branch name pattern: `main`).

## Required (merge gate)

- [ ] **Require a pull request before merging**
  - Require at least **1 approval** (adjust for solo maintainer: 0 approvals OK if you always self-review)
- [ ] **Require status checks to pass before merging**
  - Search and enable: **`Test Audit / audit`**
  - Enable **Require branches to be up to date before merging**
- [ ] **Do not allow bypassing the above settings** (or limit bypass to repo admins only)

## Recommended (supply chain & hygiene)

- [ ] **Require conversation resolution before merging**
- [ ] **Restrict who can push to matching branches** — only maintainers / bots
- [ ] **Enable Dependabot alerts** — Settings → **Code security** → Dependabot alerts: **Enabled**
- [ ] **Enable Dependabot security updates** (auto-PR for CVE fixes)
- [ ] **Enable dependency review** — Settings → **Code security** → Dependency review: **Enabled** (blocks PRs that introduce vulnerable dependencies when configured)
- [ ] **Secret scanning** — enable if available on your GitHub plan

## Fork PR safety

- [ ] Confirm **fork pull request workflows** do not receive repository secrets (GitHub default for private repos)
- [ ] Integration tests (`seed`, smoke, security) require staging secrets — they should only run on `push` to `main` and same-repo PRs, not untrusted forks

## Vercel alignment

- [ ] Vercel project connected to `main` only for production deploys
- [ ] Production env vars set in Vercel (not committed): Supabase keys, `ADMIN_EMAIL`, `SUPABASE_JWT_SECRET`, pooler URLs
- [ ] Optional: use [docs/CI.md](./CI.md) **Option B** ignored build step so Vercel never builds `main` without a passing GitHub check

## Verify the gate works

1. Open a test PR with a deliberate lint error → **Test Audit / audit** should fail and block merge.
2. Fix the PR → check turns green → merge allowed (if approvals satisfied).
3. After merge, confirm Vercel deploy starts only after GitHub shows green.

## CI secrets inventory (staging only)

| Secret | Required |
|--------|----------|
| `DATABASE_URL` | Yes |
| `DIRECT_URL` | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes |
| `SUPABASE_JWT_SECRET` | Recommended |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Yes |
| `CASHIER_EMAIL` / `CASHIER_PASSWORD` | Yes |

Never point these at production Supabase.
