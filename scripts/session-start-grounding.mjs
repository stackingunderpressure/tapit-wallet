#!/usr/bin/env node
// Cross-Carpenter grounding gate. Runs at SessionStart.
//
// Two parallel Carpenter sessions can be working in this repo at once
// (one cutting code, one writing theory). Each works on its own branch
// and is invisible to the other until commits land on origin/main —
// main is the canonical handshake point between the two streams.
//
// This hook fires once at session start to detect drift: if origin/main
// has moved past the merge-base of the current branch, another Carpenter
// has shipped work and this session should ground against origin/main
// (PLAN.md, comms/current.json, foreman-context/carpenter-state-for-foreman.md)
// before assuming the local branch's view is current.
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

if (!mergeBase || !mainTip) {
  emit(
    `CROSS-CARPENTER GROUNDING: branch '${branch}' — could not determine drift state (origin/main not reachable). Verify state manually before any cross-path action.`,
  );
  process.exit(0);
}

if (mergeBase === mainTip) {
  emit(
    `CROSS-CARPENTER GROUNDING: branch '${branch}' is current with origin/main. No drift detected — no other Carpenter has shipped to main since this branch was rooted.`,
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
].join('\n');

emit(report);
