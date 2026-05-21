# Carpenter state — for Foreman's eyes

**Format note:** This file is the Carpenter's testimony, written
for the Foreman's eyes (Frank, running in AppCommander). The
Foreman edge function fetches it from main on every call and
injects it into Frank's system prompt BEFORE peer-memory rules.
It's the bridge that lets Frank wake up on every call already
knowing what this project looks like right now.

The Carpenter overwrites this file at every `session_ended`.

**Operator-mode note:** AppCommander has been down today. Dual-
surface comms remains active.

---

## WHAT-CHANGED-RECENTLY

**Verify pass** per operator's "don't trust verify and continue"
directive. Re-grounded in CLAUDE.md + CLAUDE_ROOT.md, re-ran all
four root gates + tapit-attest tests fresh (all green), and did
adversarial code review on the Phase 2.5 surface. Found and fixed
**two real correctness bugs**:

**Bug #1 — entry-digest used non-canonical JSON hash** (commit
`528dc81`). `createJournalEntry.ts`, `JournalCard.tsx`, and
`JournalDetail.tsx` all computed the entry's identifying digest
as `sha256(JSON.stringify(attestation))`. That broke:
- Determinism: JSON.stringify property order is implementation-
  defined for non-integer keys.
- OTS semantics: the proof should commit to the digest that
  signatures already bind (`attestationDigest`), not an ad-hoc
  hash.
- URL stability: the JSON-stringify hash changes the moment a
  second signer's signature is appended, so Phase 2.6 witness
  co-signing would break every existing entry's URL and queue
  key.
- A soft tapit-attest-integrity violation — duplicating a
  library responsibility.

Fix: import `envelopeId` from tapit-attest and use it. The
library's explicit guarantee at `envelope.ts:80` is "Stable
content address … independent of signatures and anchor, so an
envelope keeps its id as it gains signatures." That is exactly
what the wallet needs.

**Bug #2 — confirmed anchors never attached to held attestations**
(commit `78baa01`). The anchor queue was the live source of truth
but `wallet.holdings()` returned attestations with `anchor:
undefined`. So when a user backed up their wallet to Supabase and
later restored on a new device, every Bitcoin block height they
had earned would be gone — the wallet would have to re-stamp every
entry, losing the original anchor's block height permanently.
That breaks the v1 "ten years from now I can prove this existed
before that block" promise on the first restore.

Fix: WalletProvider subscribes to the anchor worker. When a row
reaches state 'confirmed' with an anchor present, the effect
finds the matching held attestation by envelopeId, builds a new
one with the anchor attached, calls `wallet.hold()` to replace
the record (envelopeId is anchor-independent so put replaces
cleanly by id), and debounces a 2-second save so a flood of
confirmations on app reopen produces one PBKDF2 cycle.

Both fixes are surgical, committed independently, and reversible
via `git revert`. Branch and main both at `78baa01`.

## Gates at session end

**Root:**
- typecheck: clean
- lint: 0 errors, 0 warnings
- test: 16/16
- build: 160 modules; WalletProvider chunk grew 3.54KB gz → 3.90KB
  gz for the attach-anchor effect; everything else unchanged

**tapit-attest:** 74 pass / 0 fail / 4 skipped (corrupted fixture
unchanged).

**Keys-never-leave audit:** clean. Private signing key lives only
inside the Wallet object's private field (in-memory only). Passphrase
in component state with the known DevTools-visibility caveat
(idle-timeout TODO covers it). Only ciphertext touches the network
and IndexedDB on the storage side.

**File-size rule** (CLAUDE_ROOT.md: 400-line warn, 800-line error):
satisfied. Largest source file is `WalletProvider.tsx` at 268 lines.

## WHAT'S-PENDING

1. **Operator browser-verifies Phase 1+2+2.5.** Specific new test:
   sign an entry → wait for "Time-verified · block N" → sign out →
   clear IndexedDB to simulate a lost device → sign back in →
   passphrase → entry still shows the SAME block height it had
   before. That confirms bug #2's fix end-to-end.
2. **Phase 2.6** (witness co-signing via in-person QR + custody-
   handoff `meta`-attestation). Now safe to cut because Bug #1's
   fix preserves entry URLs across added signatures.
3. **Phase 2.7** (documents). Reuses photo path.
4. **Idle-timeout hook** (DESIGN.md §5). HIGHER PRIORITY now that
   passphrase is in WalletContext (Phase 2.5 moved it from useRef
   to useState). Recommended pre-launch.
5. **Anchor worker fetch timeout.** `AbortController` with 30s
   timeout. Without it a slow calendar could hang a scan
   indefinitely.
6. **Multi-tab worker coordination.** `BroadcastChannel` leader
   election or shared worker. Two tabs currently both stamp the
   same digest.
7. **Anchor worker exponential backoff.** Politeness when calendar
   is down for hours: `min(5min × 2^attempts, 1hr)`.
8. **HEIC/WebP photo re-encode.** Cross-device portability via
   `canvas.toBlob` in the composer.
9. **Standing follow-ups:** OTS fixture restoration (4 skipped
   library tests), `Tap-it-Attest-main.zip` cleanup at repo root.

## WHAT-TO-FLAG

**The two bugs found were both at the seam where wallet code
touches tapit-attest.** Bug #1 duplicated a library function with
a worse implementation; bug #2 ignored a library capability (the
`anchor` field on Attestation was sitting there waiting). The
doctrine's non-negotiable #4 ("never re-implement tapit-attest")
applies in both directions — don't write code the library has,
and don't ignore code the library has waiting for you. Reviewing
the wallet's diff against the library's public surface is the
natural way to catch both kinds of failure. Worth making that a
deliberate step in future sessions.

**The verify-pass paid for itself.** Both bugs would have been
silent failures in production: Bug #1 manifests as "URL broken
after witness co-signs the entry," Bug #2 manifests as "lost all
my Time-verified badges after restore from backup." Both
shipped earlier this conversation. The pre-commit "read your own
diff adversarially" step is the rhythm that catches this class.
Frank should remind the Carpenter of this pattern before any
session that closes a Phase scope.

**The idle-timeout TODO is now the highest-priority security
follow-up** because the passphrase moved into React context this
phase. Without idle-timeout, an unlocked wallet stays unlocked
until sign-out, and an attacker with physical access has the same
powers as the operator until session expiry. The fix is small but
has UX implications.

## RECOMMENDED-NEXT-MOVES

1. Operator runs `npm install && npm run dev` against real Supabase
   credentials. Walks the full flow including a deliberate restore
   cycle to confirm Bug #2's fix end-to-end.
2. If clean → Phase 2.6 cutting session (witness co-signing via
   in-person QR + custody-handoff `meta`-attestation flow). Now
   safe to land because Bug #1's fix made entry URLs stable
   across added signatures.
3. Before Phase 3 ships externally: idle-timeout hook + anchor
   worker fetch timeout + exponential backoff. About one focused
   session for all three.
4. Phase 2.7 (documents) any time — reuses Phase 2.5 photo path.
5. Standing parallel-track items: OTS fixture restoration, zip
   cleanup.

## OPERATOR'S-CURRENT-VIBE

Disciplined and trusting. The "don't trust verify and continue"
instruction was a deliberate verification-cycle directive, and
the operator was right to call for one — two real bugs surfaced
in twenty minutes of careful re-reading. The operator continues
to run manually (AppCommander still down) and continues to grant
the Carpenter latitude to fix real issues found mid-pass. Expect
the next exchange to be either a browser-verification report or
a Phase 2.6 greenlight. The grandchild-clock pressure remains
the real schedule: the wallet has to be browser-verified and
ready for the first signed birth entry before the grandchild
arrives.

## Ideas ready to revisit

All idea entries from earlier sessions remain stage-tagged in
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.

Standing observations from prior sessions still hold:
- "Documented TODO" decay — Frank should surface in quiet
  periods. Current set: 4 SKIP_CORRUPTED_FIXTURE tests, idle-
  timeout hook, anchor worker fetch timeout, multi-tab race,
  exponential backoff, HEIC/WebP re-encode, identity round-trip
  integration test, `Tap-it-Attest-main.zip` cleanup.
- Lazy-loaded auth-vs-wallet bundle boundary is a security
  pattern.
- Signing is the commit; verification is async metadata (Phase
  2.5 reframe).
- The OTS lifecycle worker pattern generalizes to any async-
  confirm flow (Nostr ack, Shamir share collection, peer
  recovery).
- Origin can move under the Carpenter when AppCommander touches
  the repo — always fetch before reporting on repo state for
  anything from outside the wallet's commit history.

**New standing observation from this session:** review the
wallet's diff against tapit-attest's public surface before
claiming done. Both bugs found this session were at that seam.
If you wrote a hash function, check whether `attestationDigest`
or `envelopeId` already does it. If you wrote a state machine
that tracks something the Attestation envelope already has a
field for, check whether you should be using that field. Tag:
doctrine-pattern, the "library-seam audit." Worth making
mechanical as a pre-commit check eventually.
