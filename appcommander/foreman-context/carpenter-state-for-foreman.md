# Carpenter state for Foreman — 2026-05-25 — Phase A FROST library analysis

## WHAT-CHANGED-RECENTLY

Nothing in the source tree this session. Chat-only analysis session evaluating the FROST library choice that gates Phase A of the FROST-first quorum and charter-governance roadmap (`briefs/2026-05-25-frost-first-and-charter-governance-roadmap.md`). Wrote three comms artifacts: `appcommander/comms/current.json`, this file, and `appcommander/comms/carpenter-opinions.md`. Appended session_started + session_ended events to `in-flight.jsonl`. Branch `claude/wallet-implementation-questions-umXHh` sits current with `origin/main` per the SessionStart hook.

## WHAT'S-PENDING

The operator owes a chip-form answer locking the FROST library path. Four paths analyzed: Path 1 = `@cmdcode/frost` v1.1.4 pure-TS dep, Path 2 = Rust→WASM build of zcash/frost-secp256k1, Path 3 = `@frosts/secp256k1-tr` (ruled out, alpha), Path 4 = vendor cmdcode source into the tree (sovereignty stance, no safety win over Path 1). Once locked, the next dispatch can cut Phase A's first commit: write a new decisions.md entry recording the library choice, add the dep to `tapit-attest/package.json`, scaffold `tapit-attest/src/core/frost.ts` as the adapter exposing `frost.dkg.round1/round2` and `frost.sign.round1/round2/aggregate`, wire it through `tapit-attest/src/index.ts`, write `tapit-attest/test/frost-vectors.test.mjs` against IETF RFC 9591 vectors, bump tapit-attest to `0.2.0-wallet.0`, run all four gates.

## WHAT-TO-FLAG

The brief contains an internal contradiction Frank should be aware of: operator-locked decision #1 says "Use a vetted Rust-via-WASM build of FROST-Secp256k1" but the candidate table immediately below labels the choice "Decision deferred to Phase A" and lists two pure-TS options alongside the WASM one. Both statements cannot be true. The chip-form question I'm sending the operator surfaces this directly. If the operator confirms the WASM lock, Phase A's session estimate should bump from 1-2 to 2-3 sessions because `scripts/bundle-budget.mjs` doesn't scan `.wasm` files today and will need extending as a prerequisite to the first Phase A build-gate pass.

Live-npm correction worth carrying forward: the brief lists `frostlib` as a TS candidate, but no package by that name exists on the npm registry. The actual TS shortlist is `@cmdcode/frost` v1.1.4 (the one I'd recommend) and `@frosts/secp256k1-tr` v0.2.2-alpha.3 (alpha, ruled out). Update the brief or future briefs that reference the same shortlist.

## RECOMMENDED-NEXT-MOVES

Operator answers the chip-form question. Then a follow-up dispatch with one of these two shapes depending on the answer:

If Path 1 (`@cmdcode/frost`): one-session dispatch — add dep, write adapter, write RFC 9591 vector tests, bump version, run gates, commit. Lazy-load defer to Phase B.

If Path 2 (WASM): two-to-three-session dispatch — session A vendors the Rust crate and writes the build pipeline plus extends bundle-budget for wasm; session B writes the async adapter and the vector tests; session C runs gates, fixes whatever the wasm-loading async boundary breaks, commits.

## OPERATOR'S-CURRENT-VIBE

Direct and decisive. Asked for "the best way" plus "full analysis of each path" in one sentence — wants both the recommendation and the reasoning so he can second-guess my recommendation if it doesn't sit right. The phrasing "fire up and tell me" reads as a check-in after some elapsed time; the chat reply opens with the brief contradiction immediately to respect his time. He'll appreciate the chip-form close per PFOR-019 — that's the fastest way for him to lock the path from his phone without typing.

## Ideas ready to revisit

Nothing new surfaced this session. The four paths were derived from the brief and the live npm registry; no operator-surfaced ideas beyond the brief itself were spoken in this session, so no new entries are added to `project-memory/foreman-memory/projects/tapit-wallet/ideas.md` from this analysis. The contradiction in the brief is a process-mechanism observation, not a Tapit-product idea, and it's captured in `WHAT-TO-FLAG` above where Frank will act on it.
