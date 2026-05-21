# Carpenter state — for Foreman's eyes

**Format note:** This file is the Carpenter's testimony, written
for the Foreman's eyes (Frank, running in AppCommander). The
Foreman edge function fetches it from main on every call and
injects it into Frank's system prompt BEFORE peer-memory rules.
It's the bridge that lets Frank wake up on every call already
knowing what this project looks like right now.

The Carpenter overwrites this file at every `session_ended`.

**Operator-mode note:** AppCommander is currently down. The
operator is reading this repo manually and asked the Carpenter
to keep writing comms records here AND narrate live in chat. The
contents of this file are still accurate; they just have a
mirror in the Claude Code chat surface for the duration of the
manual mode.

---

## WHAT-CHANGED-RECENTLY

Session 2026-05-21 afternoon (`sign-poison-fix-2026-05-21-1779331068`)
applied the sign-poisoning fix to `tapit-attest/src/core/keys.ts`
`verifyEnvelope` and bumped the library to `0.1.1-wallet.0`. The
fix changes the validity rule from all-signatures-must-verify to
quorum-of-good — at least one valid signature suffices, invalid
signatures are reported on their `SignerResult` row and in the
`errors` array but no longer poison the overall `valid` flag, and
duplicate bad rows for an otherwise-valid signer are dropped from
errors. The wallet's bundled `VerifyResult` shape is preserved, so
every caller in `sync.ts`, `weighting.ts`, `revocation.ts`,
`recovery.ts`, and `wallet.ts` continues to work — each one
benefits from the new semantics, none break.

Two regression tests were added in `tapit-attest/test/keys.test.mjs`:
one reproduces the relayer-appended junk signature attack and
asserts the envelope still validates with the real signer reported
valid and the fake signer reported invalid; the other asserts that a
duplicate bad row for a valid signer does not surface as an error.
Both pass.

Two commits pushed to `claude/compare-library-wallet-OW5FF`:
`a8e9b09` (fix + tests) and `9d1a131` (version bump).

Gates on `tapit-attest`: typecheck green, lint green, build green,
tests 74 of 78 passing. The four failures are baseline
(`ots-codec.test.mjs` parsing `test/fixtures/authorship-record.ots`)
and were confirmed to predate this session by stashing the change
and re-running. The fixture is UTF-8-corrupted at rest (bytes
`0xbf 0x89 ...` were rewritten as replacement-character runs).

## WHAT'S-PENDING

1. Operator decision on whether to merge
   `claude/compare-library-wallet-OW5FF` into main. The branch
   carries `DESIGN.md`, the comms quartet from this morning, the
   sign-poisoning fix, and the version bump. Three commits worth
   of real work currently invisible to anyone fetching main.
   Recommendation: merge once `DESIGN.md` is reviewed and approved.
2. Phase 1 cutting: PWA shell (Vite + React + TS + Tailwind),
   Supabase magic-link auth, `tapit-attest` wired as `file:`
   dependency, on-first-login passphrase prompt + `generateKeypair()`,
   encrypted snapshot to IndexedDB + Supabase, single home screen
   showing the new pubkey. One session per `DESIGN.md` §10.
3. Disposition of dormant bot scaffolding (`src/features/persona/`,
   `src/features/temporal/`, `src/features/suggested-questions/`,
   `src/features/snapshot-builder/`, plus
   `supabase/functions/_shared/botRuntime.ts` and `persona.ts`).
   `DESIGN.md` is explicit: no bot in v1. Either delete or write
   `manifest.ts` files marked `pause_safe: true`. Decision pending.
4. `Tap-it-Attest-main.zip` (116KB) still at repo root. Operator
   said "delete later." Cleanup pending.
5. `ots-codec` fixture restoration. `test/fixtures/authorship-record.ots`
   needs a binary-clean replacement of the corrupted bytes. Out of
   scope for this session; tracked for a focused fixture session.
6. `PLAN.md` update to match the six phases in `DESIGN.md`. Per
   `DESIGN.md` §header, this happens in the same session that lands
   Phase 1 code — not before.

## WHAT-TO-FLAG

The strict reading of the branch protocol is "gates must pass
before push" with the implication of green-floor. The wallet's
`tapit-attest` tests are not entirely green — four ots-codec tests
fail. The failures are baseline (predate this session) and the
cause is fixture corruption, not code, but if a future Carpenter
or the Foreman flags this branch as non-mergeable for that reason
they would be technically correct. The pragmatic read is that the
fixture is a known-bad blob and the four failing tests should be
treated as a separate Carpentry task. The strict read is that the
fixture must be restored before main accepts this branch. Operator
gets to choose between pragmatic and strict.

The library's bundled version now diverges from upstream — this is
intentional per `DESIGN.md` §11. Future readers seeing
`0.1.1-wallet.0` should know the wallet's copy carries a local
patch and should not be replaced wholesale from a fresh upstream
pull without re-applying the sign-poisoning fix.

## RECOMMENDED-NEXT-MOVES

1. Operator reads `DESIGN.md` (if not yet) and approves.
2. Operator decides on the merge to main (recommended: merge once
   DESIGN.md is approved).
3. Carpenter cuts Phase 1: Vite project shell, `npm install`,
   `tapit-attest` as `file:` dependency, Supabase magic-link auth
   via `@supabase/supabase-js`, passphrase prompt on first login,
   key generation, encrypted snapshot persisted to IndexedDB and
   Supabase, single home screen with the pubkey. PWA manifest +
   service worker. One session.
4. Carpenter handles the dormant bot scaffolding decision as the
   second order of business in the Phase 1 session — either delete
   the four feature folders + the supabase _shared bot files, or
   add `manifest.ts` files marking them paused. Recommended:
   delete now and let Phase 7+ rebuild from scratch when the bot
   is actually being built; deleting keeps the repo honest about
   what is being shipped.
5. The fixture-restoration task is a 15-minute focused session
   that can happen any time the operator wants a clean test run.
   Not blocking Phase 1.

## OPERATOR'S-CURRENT-VIBE

Decisive, forward-moving, willing to delegate judgement. He told
me to keep going until I decided we had enough to start code, and
my report back is that we do. He is comfortable with the
dual-surface comms mode (files plus chat) and wants me to "present
here" — meaning narrate substantive output in chat so he has eyes
without needing AppCommander. He said "I'm working" earlier and
the work since then has been continuous flow without distraction.
He is in build mode, not design mode. The next session he opens
should be Phase 1 cutting unless he comes back with a "no, more
design first" — which would surprise me.

## Ideas ready to revisit

The 27 provisional D-decisions from the library-context design
doc remain unimported into this repo's
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
Carry forward as raw-insight entries with library-context
provenance noted, sometime during Phase 2 or 3, once the wallet
has its own ground-truth experience to argue from. Specific entries
worth lifting first when the time comes:

- D24 NFC tap-context-aware: relevant to Phase 5 (inter-app sign
  request) once deeplink is in place — NFC is the post-v1 polish
  layer for the same flow.
- D25 tap-to-cosign-for-recovery: relevant to Phase 3 (social
  recovery) — NFC is the post-v1 polish layer for step 3 of the
  recovery flow.
- D26 opinionated mycelium category defaults: deferred to Layer 3
  (the Mycelium network), which is post-v1.
- D27 transitive trust depth defaults: deferred to Layer 3 as well.
- D2 Group keys with FROST/MuSig2: deferred to Phase 8+ per
  `DESIGN.md`.

Bot-feature carryover: `src/features/persona`, `temporal`,
`suggested-questions`, `snapshot-builder` and the bot runtime are
candidates for explicit deletion as part of the Phase 1 cleanup.
If the operator wants them preserved for a future Phase 7+ bot
build, they should get `manifest.ts` files marked `pause_safe: true`
with `removal_safe: true` so the manifest doctrine's audit test
captures their dormant status accurately.
