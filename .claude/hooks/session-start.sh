#!/usr/bin/env bash
# .claude/hooks/session-start.sh
#
# SessionStart hook — comms v2 self-reinforcing loop opener.
#
# Pulls main and surfaces the most recent .carpenter/session.json
# narrative as context for this session. Per the doctrine, the
# carpenter reads what the previous carpenter wrote and uses
# next_session_starts_with as the primary directive.
set -u

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

# Best-effort fetch + pull main. Offline is not a gate failure.
git fetch origin main --quiet 2>/dev/null || true
git pull origin main --quiet --ff-only 2>/dev/null || true

SESSION_FILE=".carpenter/session.json"
if [ ! -f "$SESSION_FILE" ]; then
  echo "Comms v2: no .carpenter/session.json yet. First session on this repo under the new doctrine."
  exit 0
fi

if command -v jq >/dev/null 2>&1; then
  echo "=== Previous session ==="
  jq -r '.session.id // "unknown"' "$SESSION_FILE" | sed 's/^/Session: /'
  jq -r '.session.outcome // "unknown"' "$SESSION_FILE" | sed 's/^/Outcome: /'
  echo ""
  echo "What the previous carpenter did:"
  jq -r '.narrative.what_i_did // ""' "$SESSION_FILE"
  echo ""
  echo "What's pending:"
  jq -r '.narrative.whats_pending // ""' "$SESSION_FILE"
  echo ""
  echo "Next session should start with:"
  jq -r '.next_session_starts_with // ""' "$SESSION_FILE"
else
  echo "Previous session record (jq unavailable, raw):"
  cat "$SESSION_FILE"
fi

exit 0
