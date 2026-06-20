#!/usr/bin/env bash
# Provision Vercel env vars from .env.production.example layout.
# Run from moto-pos root after: vercel link
#
# Usage:
#   cp .env.production.local .env.production.local   # fill real values locally, gitignored
#   source scripts/vercel-env-template.sh
#
# Or set each var manually in Vercel Dashboard → Settings → Environment Variables.

set -euo pipefail

ENV_FILE="${1:-.env.production.local}"
TARGET="${VERCEL_ENV:-production}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Create $ENV_FILE from .env.production.example with real secrets."
  exit 1
fi

echo "Pushing env vars to Vercel ($TARGET) from $ENV_FILE"
echo "DATABASE_URL must use port 6543 (transaction). DIRECT_URL must use port 5432 (session)."
echo ""

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^#.*$ ]] && continue
  [[ -z "${line// }" ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  [[ -z "$key" || -z "$val" ]] && continue
  printf '%s' "$val" | vercel env add "$key" "$TARGET" --force
  echo "  ✓ $key"
done < "$ENV_FILE"

echo ""
echo "Verify pooler ports:"
vercel env pull .env.vercel.check --environment="$TARGET" 2>/dev/null || true
grep -E 'DATABASE_URL|DIRECT_URL' .env.vercel.check 2>/dev/null | sed 's/:[^@]*@/:****@/g' || true
rm -f .env.vercel.check
echo "Done."
