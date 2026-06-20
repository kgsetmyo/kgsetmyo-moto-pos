<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

- Auth interception uses **`src/proxy.ts`** and `export function proxy()` — not `middleware.ts`.
<!-- END:nextjs-agent-rules -->

# Moto POS agent rules

- **Env:** `.env.local` for secrets; never commit. Use `.env.example` as template.
- **Auth:** `requireProfile()` on API routes; `ADMIN_EMAIL` env for admin role. Set `SUPABASE_JWT_SECRET` for JWT signature verification on page/API session checks.
- **DB changes:** add numbered SQL under `supabase/migrations/`; apply via Supabase SQL Editor or `npm run migrate:*` scripts.
- **Tests:** `npm run test:audit` before merge; CI runs seed + build + smoke + security.
- **UI:** Joy UI components; match existing patterns in `src/components/`.
- **Scope:** minimal diffs; do not refactor unrelated code.

See [CLAUDE.md](./CLAUDE.md) and [docs/HANDOVER.md](./docs/HANDOVER.md) for full project context.
