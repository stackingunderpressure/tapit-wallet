#!/usr/bin/env node
// Closed-loop hand-off enforcement — the second half of the gate the
// SessionStart hook opens. Runs on Stop.
//
// The doctrine in CLAUDE.md:
//
//   1. SessionStart (scripts/session-start-grounding.mjs) reads
//      CARPENTER_HANDOFF.md from origin/main and injects it as
//      additionalContext, so no carpenter ever opens blind.
//   2. The carpenter works, commits, writes the close-out comms
//      (CARPENTER_HANDOFF.md, current.json, interactions.jsonl,
//      in-flight.jsonl, carpenter-opinions.md, carpenter-state-
//      for-foreman.md).
//   3. THIS HOOK (Stop) refuses to let the assistant stop while
//      the current branch has commits ahead of origin/main. The
//      doctrine says "Direct-to-main authorized" (CLAUDE.md Branch
//      protocol); the carpenter's close-out push completes the loop
//      so the NEXT session's SessionStart fetch reads the handoff
//      this carpenter wrote.
//
// Leaving commits stranded on a feature branch breaks the loop —
// the next carpenter's SessionStart reads a stale letter from main
// and either duplicates work or opens blind to your changes. That
// failure mode is what the prior session and this one both hit; the
// hook closes the trap.
//
// Behaviour:
//   - HEAD == origin/main: silent exit 0 (nothing to push, allow stop).
//   - HEAD ahead of origin/main: emit JSON with {decision: 'block',
//     reason: ...} pointing to the exact PFOR-016 push command.
//   - origin/main not reachable (fresh clone, offline, etc.): silent
//     exit 0 — the hook must never block a session from ending when
//     it can't determine state.
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

// Best-effort fetch — silent failure is fine if offline. The point is
// to refresh our view of origin/main before deciding whether HEAD is
// ahead. If the fetch fails, fall back to the local cached state.
run('git fetch origin main --quiet');

// If origin/main isn't reachable at all, treat as "nothing to enforce".
const mainTip = run('git rev-parse --verify origin/main');
if (!mainTip) process.exit(0);

const aheadRaw = run('git rev-list --count origin/main..HEAD');
const ahead = Number.parseInt(aheadRaw, 10);
if (!Number.isFinite(ahead) || ahead === 0) process.exit(0);

const branch = run('git rev-parse --abbrev-ref HEAD') || 'HEAD';
const recentLog = run(`git log --oneline origin/main..HEAD`)
  .split('\n')
  .slice(0, 8)
  .join('\n');

// Comms-flush sanity: surface whether CARPENTER_HANDOFF.md was
// included in the unpushed range so the reason text can name
// the right next step (just push vs write-the-flush-then-push).
const changedFiles = run(`git diff --name-only origin/main..HEAD`)
  .split('\n')
  .filter(Boolean);
const handoffWritten = changedFiles.includes('CARPENTER_HANDOFF.md');
const commsWritten = [
  'appcommander/comms/current.json',
  'appcommander/comms/carpenter-opinions.md',
  'appcommander/foreman-context/carpenter-state-for-foreman.md',
].some((f) => changedFiles.includes(f));

const flushStatus = handoffWritten && commsWritten
  ? `Close-out flush IS in this commit range (CARPENTER_HANDOFF.md + AppCommander comms touched). Just push.`
  : !handoffWritten && !commsWritten
    ? `Close-out flush is NOT in this commit range. Write the close-out FIRST (overwrite CARPENTER_HANDOFF.md with the five-section letter, refresh appcommander/comms/{current.json,interactions.jsonl,in-flight.jsonl,carpenter-opinions.md} + appcommander/foreman-context/carpenter-state-for-foreman.md), THEN push.`
    : handoffWritten
      ? `CARPENTER_HANDOFF.md was written but the AppCommander comms (current.json, carpenter-opinions.md, carpenter-state-for-foreman.md) were not. Finish the close-out flush, THEN push.`
      : `AppCommander comms were written but CARPENTER_HANDOFF.md was not. Write the carpenter-to-carpenter letter at repo root, THEN push.`;

const reason = [
  `Closed-loop hand-off gate — refusing to stop with ${ahead} commit(s) ahead of origin/main on branch '${branch}'.`,
  ``,
  `Per CLAUDE.md Branch protocol ("Direct-to-main authorized. Gates must pass before push.") and PFOR-016 (sandbox direct-to-main pattern), push the branch tip directly to remote main without checking out local main:`,
  ``,
  `    git push origin ${branch}:main`,
  ``,
  `Unpushed commits this branch carries that origin/main does not:`,
  recentLog,
  ``,
  `${flushStatus}`,
  ``,
  `The next carpenter's SessionStart reads CARPENTER_HANDOFF.md from origin/main. If you stop without pushing, the next session opens blind to your work and either duplicates it or grounds against the stale letter — exactly the failure mode this gate prevents.`,
].join('\n');

process.stdout.write(JSON.stringify({ decision: 'block', reason }) + '\n');
process.exit(0);
