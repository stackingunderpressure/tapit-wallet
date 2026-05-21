# Carpenter state — for Foreman's eyes

**Format note:** This file is the Carpenter's testimony, written
for the Foreman's eyes (Frank, running in AppCommander). The
Foreman edge function fetches it from main on every call and
injects it into Frank's system prompt BEFORE peer-memory rules.
It's the bridge that lets Frank wake up on every call already
knowing what this project looks like right now.

The Carpenter overwrites this file at every `session_ended`.

---

## WHAT-CHANGED-RECENTLY

Session 2026-05-21 wrote `DESIGN.md` at the repo root. Three
hundred and ninety-five lines. Synthesizes the operator
conversation from this session into a v1 wallet design. Committed
as `1b890f5` on branch `claude/compare-library-wallet-OW5FF` and
pushed. No code changed; markdown only.

The operator uploaded `Tap-it-Attest-main.zip` into the repo root
(116KB) — the upstream tapit-attest library timeline. Compared
file-by-file against the wallet's bundled `tapit-attest/` folder.
Conclusion: the zip is an older code timeline (v0.1.1) with a
richer design conversation; the wallet's bundled copy is further
along on code (v0.1.0 but carrying a real Wallet core object and
real OpenTimestamps codec the upstream lacks). The only code worth
cherry-picking from the upstream is the sign-poisoning fix in
`verifyEnvelope`. That fix is queued, not yet applied.

The wallet's `tapit-attest/src/core/keys.ts` `verifyEnvelope`
currently has the bug: returns `valid: false` if any signature
fails. A relayer can poison a genuine envelope by appending a
junk signature.

## WHAT'S-PENDING

1. Operator review of `DESIGN.md`. If approved, apply the
   sign-poisoning fix to `tapit-attest/src/core/keys.ts`
   `verifyEnvelope` (change to quorum-of-good semantics, add
   regression test).
2. Then begin Phase 1: PWA shell + Supabase magic-link auth +
   key generation. Vite + React + TS + Tailwind project scaffold,
   `tapit-attest` wired as `file:` dependency, on-first-login
   passphrase prompt and `generateKeypair()` call, encrypted
   snapshot stored to IndexedDB and Supabase.
3. Decision pending: whether to import the zip's `DESIGN.md` and
   `DATA_MODEL.md` (the 27-decision provisional conversation) into
   a top-level `archive/` folder as traceability before deleting
   the outer zip from the repo. Operator has not weighed in.
4. `PLAN.md` phases need updating to match the new six-phase
   build in `DESIGN.md`. Lower priority — `DESIGN.md` declares
   itself the winner on conflict.

## WHAT-TO-FLAG

The operator's reframe — identity is the attestation chain, not
the keypair — is the load-bearing design move and it deserves
explicit acknowledgement back to him. It changes how every
downstream phase thinks about key loss, custody, and recovery.
The social-recovery flow as designed (N of M designated attesters
signing a meta-attestation that binds a new key to the previous
identity via the succession chain) composes primitives the library
already has and does not require new library features for v1
beyond the disclosure-proof slot in Phase 4.

The uploaded zip is still committed to the repo root. Workable
but untidy. Should be cleaned up once the operator decides whether
to archive its contents or just delete it.

The bot is explicitly out of v1 by operator decision this session
("we don't need the bot right now"). The feature manifest for
`wallet-bot` exists in this skeleton and should be paused or
removed before Phase 1 ships, per the manifest doctrine's
`pause_safe` flag.

## RECOMMENDED-NEXT-MOVES

1. Operator reads `DESIGN.md` and signs off (or sends revisions).
2. Carpenter applies sign-poisoning fix to `tapit-attest`.
3. Carpenter scaffolds Phase 1 — Vite project shell, Supabase
   auth, key generation, encrypted snapshot. One session.
4. Phase 2 (identity attestation + backup posture) immediately
   follows because Phase 1 alone is not user-visible enough to
   meaningfully test.

## OPERATOR'S-CURRENT-VIBE

Engaged, moving fast, design-mode. Sent a hundred and twenty
word voice-typed message in this session with a complete recovery
model and a family-as-leaves model already worked out in his head
— I synthesized rather than invented. He explicitly does not want
the bot in v1 and explicitly wants zero-friction UI. He is ready
to start building once the design is locked. He is OK with
provisional decisions and wants them treated as provisional rather
than concrete. He said "I'm working" at the end of his last
message — meaning he is in flow and wants forward motion, not
ceremony.

## Ideas ready to revisit

Living-ideas log not yet established in this project's
foreman-memory. The 27 provisional D-decisions from the
library-context design doc constitute a substantial set of
candidate ideas (D24 NFC tap-context-aware, D25 tap-to-cosign, D26
opinionated mycelium category defaults, D27 transitive trust depth
defaults) that should land in a proper ideas.md in this repo's
foreman-memory once the design conversation has matured enough to
sort them. Recommend creating
`project-memory/foreman-memory/core/ideas.md` in Phase 1 or 2 and
back-populating these as "raw insight" entries with the
library-context provenance noted.
