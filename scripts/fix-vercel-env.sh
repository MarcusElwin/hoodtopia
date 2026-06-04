#!/usr/bin/env bash
# One-shot: fix the Sensitive flag on NEXT_PUBLIC_* vars and copy every var
# to preview+development so PR deploys actually have them.
#
# Why this exists: `vercel env add` defaults to --sensitive on prod+preview,
# which blocks the bundler from inlining NEXT_PUBLIC_* into the client. The
# CLI can't edit in place, so we remove + re-add with --no-sensitive.
#
# Run from repo root after:
#   vercel env pull .env.vercel.production --environment=production --yes
set -euo pipefail

ENV_FILE=".env.vercel.production"
LOCAL_FILE=".env.local"
[[ -f "$ENV_FILE" ]] || { echo "missing $ENV_FILE — run: vercel env pull $ENV_FILE --environment=production --yes"; exit 1; }
[[ -f "$LOCAL_FILE" ]] || { echo "missing $LOCAL_FILE (needed as fallback when prod stored empty)"; exit 1; }

PUBLIC_VARS=(
  NEXT_PUBLIC_KUSTOM_ELEMENTS_API_KEY
  NEXT_PUBLIC_KUSTOM_ELEMENTS_SRC
  NEXT_PUBLIC_SITE_URL
)

SECRET_VARS=(
  KUSTOM_API_BASE_URL
  KUSTOM_API_KEY
  KUSTOM_USERNAME
  KUSTOM_MERCHANT_ID
  KUSTOM_CALLBACK_SECRET
  KUSTOM_SHIPPING_KEY
  KUSTOM_SHIPPING_JWT_SECRET
  TURSO_DATABASE_URL
  TURSO_AUTH_TOKEN
  GEMINI_API_KEY
  OPENAI_API_KEY
)

# Quick sanity check the listing — TURSO_* should be in here.
# (Earlier output showed it was, so just re-running the script picks it up.)

_read_from() {
  local file="$1" name="$2" line v
  line="$(grep "^$name=" "$file" | head -1)" || return 1
  [[ -n "$line" ]] || return 1
  v="${line#*=}"
  [[ "${v:0:1}" == '"' && "${v: -1}" == '"' ]] && v="${v:1:${#v}-2}"
  printf '%s' "$v"
}

get_val() {
  # Prefer .env.local (real value), fall back to pulled prod file.
  local v
  v="$(_read_from "$LOCAL_FILE" "$1" 2>/dev/null || true)"
  if [[ -z "$v" ]]; then
    v="$(_read_from "$ENV_FILE" "$1" 2>/dev/null || true)"
  fi
  printf '%s' "$v"
}

# For `preview`, pass an explicit empty git-branch arg ("") so the CLI
# applies to ALL preview branches without prompting. Production and
# development don't take a branch arg.
_run_add() {
  local name="$1" scope="$2" val="$3" sens_flag="$4"
  if [[ "$scope" == "preview" ]]; then
    vercel env add "$name" "$scope" "" --value "$val" "$sens_flag" --force --yes </dev/null >/dev/null
  else
    vercel env add "$name" "$scope" --value "$val" "$sens_flag" --force --yes </dev/null >/dev/null
  fi
}

add_public() {
  local name="$1" val
  val="$(get_val "$name")"
  [[ -n "$val" ]] || { echo "  skip (empty in both .env.local and prod): $name"; return; }
  echo "  $name → non-sensitive, prod+preview+dev  (len=${#val})"
  for scope in production preview development; do
    vercel env rm "$name" "$scope" --yes >/dev/null 2>&1 || true
    _run_add "$name" "$scope" "$val" "--no-sensitive"
  done
}

add_secret_to_previews() {
  local name="$1" val
  val="$(get_val "$name")"
  [[ -n "$val" ]] || { echo "  skip (empty): $name"; return; }
  echo "  $name → preview(sensitive) + dev(non-sensitive)  (len=${#val})"
  # Vercel rejects --sensitive on Development; only Production+Preview support it.
  vercel env rm "$name" preview --yes >/dev/null 2>&1 || true
  _run_add "$name" preview "$val" "--sensitive"
  vercel env rm "$name" development --yes >/dev/null 2>&1 || true
  _run_add "$name" development "$val" "--no-sensitive"
}

echo "==> Re-adding NEXT_PUBLIC_* vars as non-sensitive (all envs)"
for v in "${PUBLIC_VARS[@]}"; do add_public "$v"; done

echo "==> Copying secret vars to preview + development (sensitive)"
for v in "${SECRET_VARS[@]}"; do add_secret_to_previews "$v"; done

echo "==> Done. Verify with: vercel env ls"
