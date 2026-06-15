# Quarterback workflow & build-fee discipline (2026-06-15)

> Status: BINDING operator directive on every session and agent in this repo.
> This OVERRIDES the "Direct-to-main authorized" line in CLAUDE.md and the
> carpenter-doctrine Stop-hook behavior. The cross-repo architecture lives in
> the DynastyTrust repo at `docs/build-map-and-cut-lists.md`,
> `docs/sovereignty-education-bot.md`, and the canonical copy of this workflow
> at `docs/quarterback-workflow.md`. This brief mirrors it here so this repo is
> on target.

## Why this exists

A Netlify production build fires and bills on every push to the production
branch. The prior `.claude/hooks/session-close.sh` pushed the working branch to
`main` (`${CURRENT_BRANCH}:main`) on every session close -- a production build,
and a fee, every single time. That hook has been changed (2026-06-15) to push
the working branch ONLY and to tag its checkpoint commit `[skip ci]`. Nothing in
this repo auto-pushes to main anymore.

## The branch + merge rule

- All work stays on the working branch (`claude/<topic>-<id>`). Never push
  `main` as part of routine cutting; never use a `branch:main` refspec.
- Code and context accumulate across many cuts on the branch.
- The merge to `main` happens deliberately, in a few big batches, ONLY on the
  operator's explicit go -- one production build per batch, not per cut.
- Routine branch commits carry `[skip ci]`; the deliberate merge-to-main commit
  omits it so exactly that one build runs.
- Operator-only dashboard step: disable Branch Deploys / Deploy Previews for
  working branches (or pause auto-publish) so the production branch is the sole
  build trigger.

## Roles

- Quarterback (the orchestrating session, currently driven from the DynastyTrust
  side): holds the cross-repo map, enforces the rails + flavors, keeps the
  dependency order (tapit-attest -> tapit-wallet -> DynastyTrust), runs gates,
  decides cut order, fans out parallel agents, integrates, controls pushes/merges.
- Auditor (fresh-eyes agent, read-only): spawned at phase boundaries / every few
  cuts to check the diff against the roadmap, the risk register, the five
  flavors, and green gates; reports drift; quarterback corrects before continuing.

## The operator's decision filter (the five flavors)

Resolve any choice with these before asking: make it frictionless; make it
secure; don't go the easy cheap way; don't trust, verify; build it like Bitcoin
would be proud of every step. If they answer it, proceed.

## Repo-specific note

The manifest doctrine still holds: every `src/features/<slug>/` cut ships its
`manifest.ts` in the same commit and registers it, and the vitest coverage test
must pass -- that is part of "gates stay green." The comms loop
(`.carpenter/session.json` + the two hooks) still runs, but the Stop hook now
pushes the working branch only. Gates before any push: `npm run typecheck`,
`npm run lint`, `npm test`, `npm run build`.
