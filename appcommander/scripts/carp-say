#!/usr/bin/env bash
# carp-say — Insert a carpenter-role message on the current dispatched session.
#
# Used by the dispatched Carpenter (via Bash tool) to surface progress, ask
# the operator a question, or announce that a chunk is done. The cockpit's
# conversation pane polls dispatched_session_messages every 5s and renders
# new carpenter rows as bubbles.
#
# Required env (set by the workflow):
#   SUPABASE_URL                — Supabase project URL
#   SUPABASE_SERVICE_ROLE_KEY   — service role key (bypasses RLS)
#   DISPATCH_ID                 — the dispatched_sessions.id this run owns
#
# Usage:
#   carp-say "Pushed the hooks. Want me to wire the conversation pane next?"
#   echo "multi-line content" | carp-say
set -euo pipefail

if [ "$#" -ge 1 ]; then
  MSG="$1"
else
  MSG="$(cat)"
fi

if [ -z "${MSG:-}" ]; then
  echo "carp-say: empty message — nothing to send" >&2
  exit 2
fi

: "${SUPABASE_URL:?SUPABASE_URL not set}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY not set}"
: "${DISPATCH_ID:?DISPATCH_ID not set}"

body="$(jq -n \
  --arg dispatch_id "$DISPATCH_ID" \
  --arg content "$MSG" \
  '{dispatch_id: $dispatch_id, role: "carpenter", content: $content}')"

curl -sS --fail-with-body \
  -X POST "${SUPABASE_URL%/}/rest/v1/dispatched_session_messages" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "$body" \
  > /dev/null

echo "carp-say: sent (${#MSG} chars)" >&2
