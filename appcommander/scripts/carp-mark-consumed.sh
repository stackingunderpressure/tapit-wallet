#!/usr/bin/env bash
# carp-mark-consumed — Mark a single dispatched_session_messages row as
# consumed. Used by the workflow loop wrapper after feeding an operator
# message into the next claude --print prompt.
#
# Usage: carp-mark-consumed <message_id>
set -euo pipefail

ID="${1:?usage: carp-mark-consumed <message_id>}"

: "${SUPABASE_URL:?SUPABASE_URL not set}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY not set}"

now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
body="$(jq -n --arg consumed_at "$now" '{consumed_at: $consumed_at}')"

curl -sS --fail-with-body \
  -X PATCH "${SUPABASE_URL%/}/rest/v1/dispatched_session_messages?id=eq.${ID}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "$body" \
  > /dev/null
