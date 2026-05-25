#!/usr/bin/env node
// Cross-Carpenter grounding gate + tip-of-main hand-off inheritance.
// Runs at SessionStart.
//
// Two purposes layered together:
//
// 1) DRIFT DETECTION. Two parallel Carpenter sessions can be working
//    in this repo at once. Each works on its own branch and is invisible
//    to the other until commits land on origin/main — main is the
//    canonical handshake point between the streams. This hook detects
//    whether origin/main has moved past the merge-base of the current
//    branch so the new session knows to reconcile before acting.
//
// 2) CLOSED-LOOP HAND-OFF. Every meaningful session ends by writing
//    CARPENTER_HANDOFF.md at the repo root, committing it, and pushing
//    so tip-of-main always carries the prior carpenter's letter to
//    whoever wakes up next. This hook reads that file from origin/main
//    and injects it into the new session's context so no carpenter
//    ever opens blind — they always inherit the prior carpenter's
//    state-of-the-room: what just shipped, what's hot, what's
//    land-mined, mood-read on the operator, recommended first move.
//    The loop is self-sustaining: end-of-session push guarantees
//    next-session read.
//
// Mechanism over prose. The doctrine in CLAUDE_ROOT.md says the rules
// that matter are checks, not paragraphs. This is the check.

import { execSync } from 'node:child_process';

function run(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

function emit(additionalContext) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext,
      },
    }),
  );
}

// Fetch silently so we have the latest view of origin. Failure is
// non-fatal — the hook should never block a session from starting.
run('git fetch origin --quiet');

const branch = run('git rev-parse --abbrev-ref HEAD') || 'unknown';
const mergeBase = run('git merge-base HEAD origin/main');
const mainTip = run('git rev-parse origin/main');

// Always try to read the tip-of-main hand-off letter, regardless of
// drift state. The carpenter's first read on every wake-up.
const handoffRaw = run('git show origin/main:CARPENTER_HANDOFF.md');
const handoffBlock = handoffRaw
  ? [
      `PRIOR-CARPENTER HAND-OFF (from tip-of-main CARPENTER_HANDOFF.md):`,
      ``,
      handoffRaw,
    ].join('\n')
  : `PRIOR-CARPENTER HAND-OFF: no CARPENTER_HANDOFF.md on origin/main yet. This is either the seeding session or the prior carpenter forgot to write the close-out letter. Carry on without an inheritance this once; write one at session end.`;

if (!mergeBase || !mainTip) {
  emit(
    [
      `CROSS-CARPENTER GROUNDING: branch '${branch}' — could not determine drift state (origin/main not reachable). Verify state manually before any cross-path action.`,
      ``,
      handoffBlock,
    ].join('\n'),
  );
  process.exit(0);
}

if (mergeBase === mainTip) {
  emit(
    [
      `CROSS-CARPENTER GROUNDING: branch '${branch}' is current with origin/main. No drift detected — no other Carpenter has shipped to main since this branch was rooted.`,
      ``,
      handoffBlock,
    ].join('\n'),
  );
  process.exit(0);
}

// Drift detected. Build a structured report of what's been shipped.
const commitsAhead = run(`git rev-list --count ${mergeBase}..${mainTip}`) || '?';
const recent = run(`git log --oneline ${mergeBase}..${mainTip}`)
  .split('\n')
  .slice(0, 12)
  .join('\n');

let currentSummary = '';
const currentJsonRaw = run('git show origin/main:appcommander/comms/current.json');
if (currentJsonRaw) {
  try {
    const c = JSON.parse(currentJsonRaw);
    const summary = (c.summary || '').slice(0, 280);
    currentSummary = `session_id=${c.session_id || '?'} | layer=${c.layer || '?'} | action=${c.action || '?'} | next=${(c.next || '').slice(0, 200)} | summary=${summary}${(c.summary || '').length > 280 ? '…' : ''}`;
  } catch {
    currentSummary = '(could not parse current.json on origin/main)';
  }
}

const report = [
  `CROSS-CARPENTER GROUNDING ALERT — drift detected.`,
  ``,
  `Branch '${branch}' is ${commitsAhead} commit(s) behind origin/main. Another Carpenter session has shipped to main since this branch was rooted. Before any action that touches shared paths (PLAN.md, DESIGN.md, MYCELIUM_NETWORK_SPEC.md, src/, tapit-attest/, appcommander/comms/current.json, carpenter-state-for-foreman.md), read origin/main first — the plan and comms on this branch may be stale.`,
  ``,
  `Recent commits on origin/main this branch does not have:`,
  recent,
  ``,
  `Most recent comms on origin/main (current.json):`,
  currentSummary,
  ``,
  `Required reads before any cross-path action:`,
  `- git show origin/main:appcommander/foreman-context/carpenter-state-for-foreman.md`,
  `- git show origin/main:appcommander/comms/current.json`,
  `- git show origin/main:PLAN.md`,
  ``,
  `Doctrine: main is the cross-Carpenter handshake point. If it has moved, you have not. Reconcile before acting.`,
  ``,
  handoffBlock,
].join('\n');

emit(report);
