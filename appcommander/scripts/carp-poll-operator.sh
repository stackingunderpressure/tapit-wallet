#!/usr/bin/env bash
# carp-poll-operator — Fetch the oldest unconsumed operator message on the
# current dispatched session, if any.
#
# Output format (one of):
#   <empty>                                  no unconsumed operator message
#   <id><TAB><content (newlines escaped \n)> exactly one row to act on
#
# Used by the workflow loop wrapper between claude --print iterations to
# decide whether to spin up another iteration.
set -euo pipefail

: "${SUPABASE_URL:?SUPABASE_URL not set}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY not set}"
: "${DISPATCH_ID:?DISPATCH_ID not set}"

resp="$(curl -sS --fail-with-body \
  "${SUPABASE_URL%/}/rest/v1/dispatched_session_messages?select=id,content&dispatch_id=eq.${DISPATCH_ID}&role=eq.operator&consumed_at=is.null&order=ts.asc&limit=1" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")"

# jq: empty when no row; otherwise "id<TAB>content" with literal \n for newlines
echo "$resp" | jq -r '.[0] // empty | "\(.id)\t\(.content | gsub("\n"; "\\n"))"'
