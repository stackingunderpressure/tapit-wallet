#!/usr/bin/env bash
# carp-loop — Workflow orchestration for Live Carp Chat.
#
# Replaces the single-shot `claude --print < prompt.txt` step in
# .github/workflows/dispatch-carpenter.yml with a real conversational loop:
#
#   1. Iteration 0 runs Carp on the operator's original instruction
#      (execute or opinion mode).
#   2. After iter 0, poll dispatched_session_messages for unconsumed
#      operator-role rows for up to CARP_REPLY_BUDGET_S seconds.
#   3. If an operator reply arrives, mark it consumed, compose a lighter
#      iter-N prompt with the reply + recent commits, and run Carp again.
#   4. Loop up to CARP_MAX_ITER iterations. On no reply within budget, OR
#      max iterations, OR carp writing the session_ended marker, exit.
#
# Required env (set by the workflow):
#   CLAUDE_CODE_OAUTH_TOKEN   — plan-bucket auth for claude --print
#   SUPABASE_URL              — for carp-say / carp-poll-operator
#   SUPABASE_SERVICE_ROLE_KEY — bypasses RLS so the loop can write/read
#   DISPATCH_BRANCH           — branch isolation target
#   DISPATCH_ID               — dispatched_sessions row id
#   DISPATCH_INSTRUCTION      — operator's original chunk
#   DISPATCH_PROJECT_ID       — project this dispatch belongs to
#   DISPATCH_MODE             — execute | opinion
#
# Optional env:
#   CARP_MAX_ITER             — default 6 (iteration 0 + up to 5 replies)
#   CARP_REPLY_BUDGET_S       — default 180 (3 min wait per turn)
#   CARP_POLL_INTERVAL_S      — default 10 (between polls)
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
export PATH="${SCRIPT_DIR}:${PATH}"

: "${CLAUDE_CODE_OAUTH_TOKEN:?CLAUDE_CODE_OAUTH_TOKEN not set}"
: "${SUPABASE_URL:?SUPABASE_URL not set}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY not set}"
: "${DISPATCH_BRANCH:?DISPATCH_BRANCH not set}"
: "${DISPATCH_ID:?DISPATCH_ID not set}"
: "${DISPATCH_INSTRUCTION:?DISPATCH_INSTRUCTION not set}"
: "${DISPATCH_PROJECT_ID:?DISPATCH_PROJECT_ID not set}"
: "${DISPATCH_MODE:=execute}"

CARP_MAX_ITER="${CARP_MAX_ITER:-6}"
CARP_REPLY_BUDGET_S="${CARP_REPLY_BUDGET_S:-180}"
CARP_POLL_INTERVAL_S="${CARP_POLL_INTERVAL_S:-10}"

PROMPT_FILE=/tmp/carpenter-prompt.txt
OUTPUT_FILE=/tmp/carpenter-output.txt

compose_iter0_prompt() {
  if [ "$DISPATCH_MODE" = "opinion" ]; then
    cat > "$PROMPT_FILE" <<PROMPT_EOF
You are running as a DISPATCHED Carpenter session via GitHub Actions
in OPINION MODE (read-only).

## Critical safety rules
- You are on branch: ${DISPATCH_BRANCH}
- This is a SECOND-OPINION dispatch. The operator wants your THINKING,
  not code changes.
- DO NOT modify any source code, configuration, build files, or tests.
- DO NOT run gates (typecheck/lint/test/build) — nothing changed,
  running them is wasted compute.
- The ONLY files you may write are:
    - appcommander/comms/carpenter-opinions.md (the deliverable)
    - appcommander/comms/in-flight.jsonl (event log)
    - appcommander/comms/current.json (10D record)
    - appcommander/comms/interactions.jsonl (audit log)
- The operator typically discards opinion-mode branches after reading.
  Branch isolation means even if you accidentally write code, no harm
  reaches main.

## Live Carp Chat — talk to the operator while you work
You are inside a multi-iteration workflow loop. This iteration is
iter 0 — the operator's original ask. After you finish, the workflow
will hold the runner alive for a few minutes waiting for the operator
to send a follow-up reply via the cockpit. If they do, you'll be
spawned again with their reply as iter 1.

To send the operator a message at any time, run from a Bash tool call:

  carp-say "<your message>"

You should call carp-say at least once before ending your turn — a
short summary of what you concluded, and an invitation to ask
follow-ups. The operator is reading on a phone with no other context.

## Your assignment
Read CLAUDE.md to understand the standing protocols. Then read
appcommander/foreman-context/carpenter-state-for-foreman.md — that's
the latest project-state handoff Foreman hands you on every dispatch
(per PFOR-012). It captures what just shipped, what is pending, what
to flag, and recommended next moves. Treat it as your situational
awareness preload. Then form a substantive opinion on:

${DISPATCH_INSTRUCTION}

## Required closing actions for this iteration
1. Write/overwrite appcommander/comms/carpenter-opinions.md with the
   THREE-SECTION REPORT format mandated by PFOR-014 fleet-wide:
   **What I did** (story of the session, educational voice — what
   was broken, what the fix does, what it means architecturally),
   **What you could do better** (honest unfiltered suggestions,
   risks, observations from inside the repo), **The bigger picture**
   (one teaching moment connecting the session to the thesis).
   All three sections are speech-friendly — full sentences, no
   bullet lists or sub-headers within sections, no markdown tables,
   no code blocks unless absolutely necessary. Sounds right read
   aloud. Voice is educational and slightly entertaining, not a
   robot reading a log. Length per section: two to five paragraphs.
   Cite file paths + line numbers in prose where they matter.
2. Update appcommander/comms/current.json with a 10D record
   (linked_mission_id: ${DISPATCH_ID}, action: 'review' or 'propose').
3. Append session_ended event to in-flight.jsonl with
   outcome:'completed' for THIS iteration. (The workflow may spawn
   you again for iter 1+ if the operator replies — that's fine, write
   a fresh session_started + session_ended for each.)
4. Overwrite appcommander/foreman-context/carpenter-state-for-foreman.md
   per PFOR-012 with the structured state digest for Frank's eyes.
5. Commit ONLY the comms/* and foreman-context/* changes and push to
   ${DISPATCH_BRANCH}.
6. Call: carp-say "Posted opinion. Anything you want me to dig into
   further?"
7. Complete in 25 minutes. Workflow hard-stops at 35 min total wall.

Begin.
PROMPT_EOF
  else
    cat > "$PROMPT_FILE" <<PROMPT_EOF
You are running as a DISPATCHED Carpenter session via GitHub Actions.

## Critical safety rules
- You are on branch: ${DISPATCH_BRANCH}
- You MUST push every commit to this branch only.
- You MUST NOT merge to main, push to main, or rebase onto main from this run.
- The operator will review this branch in the cockpit and tap Merge or Discard.
- Branch isolation is the safety net — do your best work; if something
  goes sideways, the operator discards the branch.

## Live Carp Chat — talk to the operator while you work
You are inside a multi-iteration workflow loop. This iteration is
iter 0 — the operator's original ask. After you finish, the workflow
will hold the runner alive for ~3 minutes waiting for the operator to
send a follow-up reply via the cockpit. If they do, you'll be spawned
again with their reply as iter 1.

To send the operator a message at any time, run from a Bash tool call:

  carp-say "<your message>"

You SHOULD call carp-say at meaningful checkpoints during the work,
not just at the end. Examples:

  carp-say "Reading the relevant feature files now."
  carp-say "Hit a fork — going with approach A. Reasoning: <why>."
  carp-say "Pushed commit abc1234. Want me to also wire the frontend?"

The operator is bouncing across multiple projects on a phone; these
breadcrumbs are how they keep up. Always end your turn with a
summary carp-say message that invites a reply.

## Your assignment
Read CLAUDE.md and follow all standing protocols (comms, gates, doctrine).
Then read appcommander/foreman-context/carpenter-state-for-foreman.md —
that's the latest project-state handoff Foreman hands you on every
dispatch (per PFOR-012). It captures what just shipped, what is
pending, what to flag, and recommended next moves. Treat it as your
situational awareness preload — you arrive ALREADY knowing the
project's current state.

## The chunk
${DISPATCH_INSTRUCTION}

## Required closing actions for this iteration
1. Run gates: npm run typecheck && npm run lint && npm test && npm run build.
   Write gate_passed/gate_failed events to appcommander/comms/in-flight.jsonl.
2. Write/overwrite appcommander/comms/carpenter-opinions.md with the
   THREE-SECTION REPORT format mandated by PFOR-014 fleet-wide:
   **What I did** (story of the session, educational voice — what
   was broken, what the fix does, what it means architecturally),
   **What you could do better** (honest unfiltered suggestions,
   risks, observations from inside the repo), **The bigger picture**
   (one teaching moment connecting the session to the thesis).
   All three sections are speech-friendly — full sentences, no
   bullet lists or sub-headers within sections, no markdown tables,
   no code blocks unless absolutely necessary. Sounds right read
   aloud. Voice is educational and slightly entertaining, not a
   robot reading a log. Length per section: two to five paragraphs.
3. Update appcommander/comms/current.json with a 10D record
   (linked_mission_id: ${DISPATCH_ID}).
4. Overwrite appcommander/foreman-context/carpenter-state-for-foreman.md
   per PFOR-012 with the structured state digest for Frank's eyes.
5. Commit and push everything to ${DISPATCH_BRANCH}. Multiple commits OK.
6. Append session_ended event to in-flight.jsonl with outcome.
7. Call: carp-say "Pushed N commits to ${DISPATCH_BRANCH}. <one-line
   summary>. Reply if you want me to keep going."
8. Complete in 25 minutes for this iteration. Workflow hard-stops at
   35 min total wall.

Begin.
PROMPT_EOF
  fi
}

compose_iterN_prompt() {
  local iter="$1"
  local reply_text="$2"
  local recent_commits="$3"

  cat > "$PROMPT_FILE" <<PROMPT_EOF
You are running iteration ${iter} of an ongoing DISPATCHED Carpenter
session via GitHub Actions. This is a continuation — the operator
sent a follow-up reply through the cockpit's compose bar.

## Critical safety rules (still apply)
- You are on branch: ${DISPATCH_BRANCH}
- Push every commit to this branch only. NEVER to main.
- Do not merge, rebase to main, or open a PR. The operator merges
  from the cockpit.

## Branch state from previous iterations
Recent commits on ${DISPATCH_BRANCH} (most recent first):

${recent_commits}

## The operator's reply

${reply_text}

## How to respond
- Treat the reply as the new chunk. Address it directly.
- Use carp-say to send the operator progress messages while you
  work. End your turn with a carp-say summary.
- For execute mode: if changes are needed, edit + commit + push to
  ${DISPATCH_BRANCH}. Run gates before exit if you changed code.
- For opinion mode: keep it read-only — only update the comms files.

## Required closing actions for this iteration
1. Update appcommander/comms/current.json with a fresh 10D record
   for THIS iteration (linked_mission_id: ${DISPATCH_ID}).
2. Append session_ended event to in-flight.jsonl with outcome.
3. Commit and push the comms updates (and any code changes for
   execute mode).
4. Call: carp-say "<one-line summary of what I did this turn>"

Complete this iteration in 15 minutes. Workflow hard-stops at 35 min
total wall — you've already burned some of that on iter 0.

Begin.
PROMPT_EOF
}

run_claude() {
  echo "::group::carp-loop · running claude --print (iter ${CURRENT_ITER})"
  # --dangerously-skip-permissions: isolated runner, branch protection,
  # operator authorized this dispatch.
  # --print: non-interactive single-shot.
  # Capture stdout AND let it stream to the log.
  set +e
  claude --dangerously-skip-permissions --print \
    < "$PROMPT_FILE" \
    | tee "$OUTPUT_FILE"
  rc=$?
  set -e
  echo "::endgroup::"
  if [ "$rc" -ne 0 ]; then
    echo "carp-loop: claude exited rc=${rc} for iter ${CURRENT_ITER}" >&2
    # Best-effort: surface the failure to the operator before bailing.
    carp-say "Hit an error mid-iteration (rc=${rc}). Workflow log will
have details. Branch isolation means main is safe." || true
    return "$rc"
  fi
}

push_branch_state() {
  # Defensive sync: claude SHOULD have pushed inside its session, but
  # capture any uncommitted scraps.
  if [ -n "$(git status --porcelain)" ]; then
    git add -A
    git commit -m "🪵 Dispatched Carpenter — uncommitted iter ${CURRENT_ITER} captured" || true
  fi
  git push origin "$DISPATCH_BRANCH" || true
}

carp_wrote_session_ended_since() {
  # Returns 0 if any line appended to appcommander/comms/in-flight.jsonl
  # since $1 (a line-count snapshot) contains an "ev":"session_ended"
  # event. Used after each run_claude to detect Carp's natural finish
  # without waiting for the reply-poll budget to drain. Mechanical
  # signal — does not depend on Carp telling us in chat.
  local lines_before="${1:-0}"
  local jsonl="appcommander/comms/in-flight.jsonl"
  [ -f "$jsonl" ] || return 1
  local lines_after
  lines_after="$(wc -l < "$jsonl" 2>/dev/null || echo 0)"
  if [ "$lines_after" -le "$lines_before" ]; then return 1; fi
  tail -n +$((lines_before + 1)) "$jsonl" 2>/dev/null \
    | grep -q '"ev":"session_ended"'
}

mark_dispatch_wrapped() {
  # PATCH the dispatched_sessions row to set ended_at +
  # session_outcome='completed' WITHOUT touching status. The row stays
  # in_flight pending operator merge/discard decision (that's correct
  # — the bubble stays visible in PendingDispatchesPanel), but the
  # cockpit's ComposeBar filters reply targets by ended_at===null so
  # Reply-to-Carp mode releases immediately when Carp writes
  # session_ended. Without this, the operator stays locked in reply
  # mode for the rest of the CARP_REPLY_BUDGET_S window even though
  # Carp finished iter 0 in seconds.
  #
  # Idempotent via status=eq.in_flight + ended_at=is.null filter.
  # Tolerates non-2xx because the workflow's success-path finalize
  # step at workflow end is the belt to this suspenders.
  if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
    echo "carp-loop: SUPABASE_URL/KEY missing — skipping wrapped PATCH; workflow-end finalize will catch"
    return 0
  fi
  local ended_at
  ended_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  local payload
  payload="$(printf '{"session_outcome":"completed","ended_at":"%s"}' "$ended_at")"
  curl -fsS -o /tmp/carp-mark-wrapped.txt \
    -X PATCH \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    "${SUPABASE_URL}/rest/v1/dispatched_sessions?id=eq.${DISPATCH_ID}&status=eq.in_flight&ended_at=is.null" \
    -d "$payload" \
    && echo "carp-loop: marked ${DISPATCH_ID} wrapped (status stays in_flight pending merge)" \
    || echo "carp-loop: warning — wrapped PATCH non-2xx; workflow-end finalize will retry"
}

poll_for_operator_reply() {
  local deadline=$(( $(date +%s) + CARP_REPLY_BUDGET_S ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    line="$("$SCRIPT_DIR/carp-poll-operator.sh" || true)"
    if [ -n "$line" ]; then
      printf '%s' "$line"
      return 0
    fi
    sleep "$CARP_POLL_INTERVAL_S"
  done
  return 1
}

# ─── main ──────────────────────────────────────────────────────────────────
echo "carp-loop: starting (max_iter=${CARP_MAX_ITER}, reply_budget=${CARP_REPLY_BUDGET_S}s)"

# Iteration 0
CURRENT_ITER=0
JSONL_LINES_BEFORE="$(wc -l < appcommander/comms/in-flight.jsonl 2>/dev/null || echo 0)"
compose_iter0_prompt
run_claude
push_branch_state

# If Carp wrote session_ended during iter 0, release the dispatch
# immediately and skip the reply-poll loop. Otherwise the compose bar
# would stay pinned in Reply-to-Carp mode for the rest of the reply
# budget even though Carp's work is already done.
if carp_wrote_session_ended_since "$JSONL_LINES_BEFORE"; then
  echo "carp-loop: iter 0 closed with session_ended — releasing dispatch + skipping reply poll"
  mark_dispatch_wrapped
  echo "carp-loop: done (final iter=${CURRENT_ITER})"
  exit 0
fi

# Capture HEAD after iter 0 so iter N prompts can show what's new.
LAST_HEAD="$(git rev-parse HEAD)"

# Iteration 1+ — only if operator replies
while [ "$CURRENT_ITER" -lt $((CARP_MAX_ITER - 1)) ]; do
  CURRENT_ITER=$((CURRENT_ITER + 1))
  echo "carp-loop: polling for operator reply (iter ${CURRENT_ITER}, up to ${CARP_REPLY_BUDGET_S}s)"

  if ! reply_line="$(poll_for_operator_reply)"; then
    echo "carp-loop: no operator reply in budget — ending session"
    break
  fi

  reply_id="${reply_line%%	*}"
  reply_text="${reply_line#*	}"
  # Un-escape \n back to real newlines for the prompt file.
  reply_text="$(printf '%b' "$reply_text")"

  echo "carp-loop: got operator reply id=${reply_id}"

  # Mark consumed BEFORE running claude so a crash can't double-feed it.
  "$SCRIPT_DIR/carp-mark-consumed.sh" "$reply_id"

  # Show recent commits since iter N-1's HEAD.
  recent_commits="$(git log --oneline "${LAST_HEAD}..HEAD" 2>/dev/null || true)"
  if [ -z "$recent_commits" ]; then
    recent_commits="(no new commits since previous iteration)"
  fi

  ITER_JSONL_BEFORE="$(wc -l < appcommander/comms/in-flight.jsonl 2>/dev/null || echo 0)"
  compose_iterN_prompt "$CURRENT_ITER" "$reply_text" "$recent_commits"
  run_claude
  push_branch_state

  # Same closure check after each iter-N — if Carp wraps mid-conversation,
  # release the dispatch and break the loop immediately.
  if carp_wrote_session_ended_since "$ITER_JSONL_BEFORE"; then
    echo "carp-loop: iter ${CURRENT_ITER} closed with session_ended — releasing dispatch + breaking loop"
    mark_dispatch_wrapped
    break
  fi

  LAST_HEAD="$(git rev-parse HEAD)"
done

# Belt to the iter-level suspenders above: if Carp exited via reply-budget
# timeout or hit max_iter without writing session_ended, mark wrapped here
# so the cockpit still releases reply mode. The workflow's success-path
# finalize step is the final backstop in case carp-loop itself errored.
mark_dispatch_wrapped

echo "carp-loop: done (final iter=${CURRENT_ITER})"
