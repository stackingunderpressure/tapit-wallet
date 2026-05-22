# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running
manual against live Netlify + Supabase deploy. Dual-surface
comms active.

---

## WHAT-CHANGED-RECENTLY

**Two operator-reported items cut and shipped** under the
operator's "not remembering magic link login / name attestation
needs to be a formal guided moment" directive. Branch
`claude/compare-library-wallet-OW5FF` at `e52603e`.

1. **Cut A — in-app 6-digit code login** (`4f1dd7f`).
   `src/features/auth/LoginPage.tsx` rewritten from a magic-link
   flow to a two-step email-then-code flow. `signInWithOtp`
   sends the code; a second screen calls `verifyOtp({type:
   'email'})`. Root cause of "login not remembered, redo every
   time": on iOS a magic link opens in Safari, a separate
   storage scope from the installed PWA, so the PWA never sees
   the session. Verifying the code in-PWA keeps the session in
   the PWA's own storage scope and it persists across launches.
   `/auth/callback` kept as a fallback for clicked links.

2. **Cut B — guided identity ceremony** (`e52603e`). The bare
   single-field `DisplayNamePrompt` replaced by
   `src/features/wallet-core/IdentityCeremony.tsx`, a four-screen
   walk: welcome (keypair born, responsibility real) → name
   (display name required + optional full name) → declaration
   (read + affirm a founding statement via checkbox) → signing.
   `createIdentityAttestation` now takes an `IdentityInput`
   object and signs `display_name`, `full_name`, `declaration`,
   `pubkey`, `created_at` as leaves. Identity attestation tier
   raised `routine` → `notable`. `FOUNDING_DECLARATION` exported
   as a constant. `DisplayNamePrompt.tsx` deleted (grep clean).
   wallet-core manifest updated in the same commit.

## GATE FENCE STATUS

Unchanged from last session — mechanically complete. All five
CLAUDE_ROOT.md gate-fence rules are base gates or mechanical
checks except the SessionStart branch hook. The five mechanical
guardrail tests (persona-contract, features-registry,
library-seam, file-size, keys-never-leave) all pass.

## Gates at session end

**Root:** typecheck / lint / test (19/19 across 5 test files) /
build all green — verified after each of the two cuts.

**tapit-attest:** unchanged 82 / 78 / 0 / 4.

**File-size guardrail:** new `IdentityCeremony.tsx` at ~270
lines is under the 400-warn tier. Largest wallet file still
`WalletProvider.tsx` at 290 lines (grew slightly with the
`onCreateIdentity` rename) — under 400, check passes clean.

## WHAT'S-PENDING

1. **Operator-side, REQUIRED for Cut A to function:** add the
   `{{ .Token }}` variable to the Supabase "Magic Link" email
   template. Without it the email carries no 6-digit code and
   the new login flow has nothing to verify. Template can keep
   `{{ .ConfirmationURL }}` too — the `/auth/callback` fallback
   still uses it.
2. **Operator browser-verifies** both new flows against the
   live deploy: the 6-digit-code login surviving a fresh PWA
   launch (force-quit then reopen, still logged in), and the
   four-screen identity ceremony. Plus the standing
   Cut-1-through-Cut-4 punch list and full v1 stack.
3. **Operator-side: Cut 2 migration**
   (`20260522000001_create_wallet_media_bucket.sql`) in the
   Supabase SQL editor if not already run.
4. **Non-blocking follow-ups** unchanged: multi-tab worker
   coordination, OTS fixture restoration (4 skipped library
   tests), Tap-it-Attest-main.zip cleanup, backfill remote
   media for pre-Cut-2 entries.
5. **Lower-value guardrail candidates** still surfaced, not cut:
   total-post-auth-bytes ceiling (worth it if the bundle trend
   climbs); manifest touches-array accuracy (Carpenter leans
   AGAINST — friction outweighs benefit).
6. **Phase 5** (Mycelium + Shamir recovery) still waits for
   MYCELIUM_NETWORK_SPEC.md.

## WHAT-TO-FLAG

**Cut A is correct-by-construction but not field-verified.** The
login fix is gate-green and the root-cause diagnosis (iOS
storage-scope split) is sound, but the end-to-end chain depends
on the operator adding `{{ .Token }}` to the Supabase email
template — operator-side work the Carpenter cannot do or test.
Until the operator walks the real flow on a phone, treat Cut A
as diagnosed-and-fixed but unconfirmed.

**The v1 surface is now feature-complete.** Login, identity
ceremony, diary, photos, cloud backup, QR, anchor worker,
guardrails — all shipped, all gate-green. There is no Carpenter
work queued. The remaining distance to ship is entirely
operator-side browser verification against the live deploy.
This is the natural moment to either confirm v1 in the field or
name a new direction (Phase 5 needs the Mycelium spec first).

**WalletProvider.tsx grew to 290 lines** with the
`onDisplayName` → `onCreateIdentity` rename and the
`IdentityInput` plumbing. Still well under the 400-line warn
tier, but it is the largest wallet file and trending up; if it
crosses 400 the file-size guardrail will warn and it should be
split (the phase state machine and the anchor-attach effect are
the natural extraction seams).

## RECOMMENDED-NEXT-MOVES

1. Operator adds `{{ .Token }}` to the Supabase email template.
2. Operator browser-verifies both new flows plus the v1 punch
   list against the live Netlify + Supabase deploy.
3. If clean: ship v1. If any stall: report the specific failure
   with screen + step.
4. Phase 5 holds for MYCELIUM_NETWORK_SPEC.md. The two
   lower-value guardrails remain available if the operator
   wants them.

## OPERATOR'S-CURRENT-VIBE

Shifting from build to field-test. The operator is now deploying
manually against live Netlify + Supabase and reporting real
bugs found in actual use — the photo-capture bug last session,
the login-not-remembered bug this session. The "verify don't
trust, reground in CLAUDE.md, look over your shoulder" rhythm
still governs every directive. The character of the work has
changed: it is no longer "build the next feature" but "fix what
the real deploy surfaces." Expect the next operator message to
be browser-verification findings — either v1 confirmed clean or
a specific new bug with reproduction steps.

## Ideas ready to revisit

All earlier idea entries hold. Updated this session:

- **The identity ceremony as a signed-statement pattern.** Cut
  B established that a UI moment can be more than UI — the
  founding declaration is rendered, affirmed, AND signed as a
  cryptographic leaf. This pattern (affirm-then-sign) is
  reusable: any future moment where a person makes a commitment
  (a relationship attestation, an agreement, a witness
  statement) could use the same render → affirm-checkbox → sign
  structure so the person's consent is itself part of the
  verifiable record.

- **The v1-complete inflection point.** With the surface
  feature-complete, the operator's leverage moves entirely to
  field verification and then to Phase 5. Worth surfacing: the
  build-to-verify-to-Phase-5 sequence is the current critical
  path, and Phase 5 is blocked on a spec the operator owns.

- **Two lower-value guardrail candidates remain** (total-bytes
  ceiling, manifest touches-accuracy) — deliberately not cut to
  avoid cruft per non-negotiable #3.

The 16+ earlier idea entries are stage-tagged in
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
