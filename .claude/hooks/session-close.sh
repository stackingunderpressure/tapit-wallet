#!/usr/bin/env bash
# .claude/hooks/session-close.sh
#
# Stop / PreCompact hook — comms v2 self-reinforcing loop closer.
#
# Writes/updates .carpenter/session.json with this session's
# narrative, archives a timestamped copy, commits, and pushes main.
# The next session's SessionStart hook will pull main and read this
# file to prime context.
#
# The CARPENTER itself is responsible for writing the narrative
# fields BEFORE this hook fires — typically by overwriting
# .carpenter/session.json near the end of the session. This hook
# handles the archival + git plumbing only.
set -u

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

SESSION_FILE=".carpenter/session.json"
ARCHIVE_DIR=".carpenter/archive"

# If no session file was written this session, bail quietly. The
# carpenter is responsible for writing it; this hook doesn't
# fabricate narrative.
if [ ! -f "$SESSION_FILE" ]; then exit 0; fi

# Sanity check the JSON parses.
if command -v jq >/dev/null 2>&1; then
  if ! jq empty "$SESSION_FILE" >/dev/null 2>&1; then
    echo "session-close: .carpenter/session.json is not valid JSON; skipping archive + push." >&2
    exit 0
  fi
fi

mkdir -p "$ARCHIVE_DIR"
TIMESTAMP="$(date -u +%Y-%m-%d-%H%M%S)"
cp "$SESSION_FILE" "$ARCHIVE_DIR/session-${TIMESTAMP}.json"

git add "$SESSION_FILE" "$ARCHIVE_DIR/session-${TIMESTAMP}.json" 2>/dev/null || true

if ! git diff --cached --quiet; then
  git commit -m "session: ${TIMESTAMP} comms checkpoint" >/dev/null 2>&1 || true
  # Push to main with simple retry on transient network errors.
  for delay in 0 2 4 8 16; do
    [ "$delay" -gt 0 ] && sleep "$delay"
    if git push origin main 2>/dev/null; then break; fi
  done
fi

exit 0
