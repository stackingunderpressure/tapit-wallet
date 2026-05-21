# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander has been down all day.
Operator wiring up Netlify + Supabase in parallel. Dual-surface
comms remains active.

---

## WHAT-CHANGED-RECENTLY

**Second autonomous-work block** under the operator's "pick the
next job ... good reason ... grounded ... continue until we get
the website" directive. Four commits landed; branch and main
both at `d1b9e20` (the latest is a comms-refresh on top of the
feature commit at `39664c4`).

1. **Phase 3 — Layer 2 inter-app deeplink pathway** (`e789d2c`).
   New `src/features/sign-request/` feature: SignRequest /
   SignGrant / SignDecline types; base64url-decoded URL param
   with strict shape validation surfacing typed
   SignRequestError codes; per-kind plain-English approval
   screen showing claimed origin + actual callback host + the
   request content; approve calls `wallet.attest` (wraps
   `createDraft + signEnvelope`), holds, queues anchoring,
   redirects to callback with a SignGrant; decline redirects
   with a structured SignDecline. Lazy-loaded `/sign` route.
   NIP-46 transport stays explicitly OUT of v1 — same shapes
   carry over later.

2. **Phase 4 library — selective leaf disclosure** (`c0bcda1`).
   `metaHash` exported from `envelope.ts`. Real
   `disclosureProof` + `verifyDisclosureProof` in
   `field-tree.ts` (DisclosureProofBundle = meta + leaf +
   sibling-hash steps + signatures). Five new tests covering
   round-trip, non-disclosure property, tamper detection on
   leaf and meta, path errors. tapit-attest now 82 tests, 78
   pass, 4 skipped (corrupted-fixture baseline unchanged).

3. **Phase 4 wallet UI — share + verify** (`6ee7f34`). New
   `src/features/disclosure/` feature: leafIndex helper walks
   the claim tree and returns each disclosable leaf with its
   path; ShareProofModal accessible from JournalDetail picks
   a leaf and outputs JSON; public `/verify` route OUTSIDE
   AuthGate (third-party verifier may not have a wallet)
   renders disclosed field + envelope meta + signers + math
   result.

4. **PLAN.md refresh** (`39664c4`). Phases 2.5 / 2.6 / 2.7 /
   3 / 4 + verify-pass + security polish marked DONE. Phase
   5 (Mycelium + Shamir) restated as deferred to
   MYCELIUM_NETWORK_SPEC.md with the technical Shamir-
   encryption-key-not-signing-key clarification carried
   forward. Phase 6 (full-keypair family custody) marked
   optional now that Phase 2.6's identity-by-attestation
   model covers the operator's grandchild scenario. Phase
   7+ non-goals enumerated. Six known follow-ups logged.

**Library-seam audit clean on every commit.** Adversarial
diff caught one pre-push bug (SignApprovalScreen busy-state
copy referenced a useMemo'd value only resolvable in ready-
state; tightened to "Signing…").

## Gates at session end

**Root:** typecheck / lint / test (16/16) / build all green
on every commit. Manifest-registry vitest test auto-picked up
sign-request and disclosure slugs.

**tapit-attest:** 82 total / 78 pass / 0 fail / 4 skipped.
Four new disclosure tests passing. Corrupted-fixture baseline
unchanged.

**Bundle posture (login surface unchanged at ~110KB gz):**
- attest (lazy): 71.09KB gz 26.40KB
- WalletProvider (lazy): 11.90KB gz 3.90KB
- HomeScreen (lazy): 15.16KB gz 4.63KB
- JournalDetail (lazy): 16.74KB gz 4.87KB — biggest lazy
  chunk, hosts five modals
- SignApprovalScreen (lazy, new): 8.28KB gz 2.86KB
- VerifyProofScreen (lazy, new) + disclosure-related shared
  chunks
- EnvelopePreview (lazy, shared by cosigning): 7.34KB gz 3.58KB

All within budgets but post-auth surface trending monotonic;
bundle-audit logged as a follow-up.

**Keys-never-leave audit clean.** Sign-request: only public
envelopes in the grant payload. Disclosure proof: meta + leaf +
sibling hashes + signatures — all public. The private key never
leaves the Wallet object's encapsulation.

**File-size rule** (CLAUDE_ROOT.md 400-line warn): satisfied.
Largest source remains WalletProvider.tsx at 273 lines.

## WHAT'S-PENDING

1. **Operator browser-verifies the full v1 stack** against the
   live Netlify+Supabase deploy when it lands. PLAN.md's
   "Recommended first move after Phase 4" section has the
   walk: login → passphrase → display-name → home with
   identity → New entry with photo → wait for Time-verified ·
   block N → Hand a co-sign request → witness signs →
   absorb → multi-signer count → /entry/:digest → Share a
   proof of one field → /verify in another tab → /sign with
   a test request → approve → callback receives grant.
2. **Phase 5 — Mycelium + Shamir recovery cascade.** Requires
   MYCELIUM_NETWORK_SPEC.md to exist first per existing
   doctrine. Spec is operator-side work the brief named as
   input.
3. **Phase 6 — Full-keypair family custody.** Now marked
   optional in PLAN.md; the operator's identity-by-attestation
   reframe makes Phase 2.6 cover the grandchild scenario.
4. **Six non-blocking follow-ups:** multi-tab worker
   coordination, HEIC/WebP photo re-encode, pre-commit
   library-seam audit script, bundle-budget audit, OTS fixture
   restoration, Tap-it-Attest-main.zip cleanup.

## WHAT-TO-FLAG

**The v1 surface is feature-complete** for everything the
operator described in the diary-first brief. Frank should
treat any operator message naming the grandchild or naming a
specific verification finding as urgent, and treat any
operator message naming Phase 5 / 6 as a spec-or-scope step
that wants explicit greenlight before autonomous initiation.

**Feature correctness is unverified.** Every line of the v1
surface has gate-level confidence (typecheck, lint, vitest,
build green). Integration-level confidence requires real
deploy + real browser walking. The PLAN.md closing section
has the operator walk.

**The pre-commit library-seam audit script** is the most
mechanical hygiene improvement available. The verbal pattern
has caught three bugs across the autonomous-work blocks
(digest-not-envelopeId, missing-idleTimeoutMs in prefs init,
SignApprovalScreen busy-state copy). A grep-based check would
catch the next variant without operator-attention cost.

**The /verify route lives OUTSIDE AuthGate** by design —
third-party verifier context. Frank should preserve this if
the route ever gets touched: making it auth-gated would break
the verifier use case.

## RECOMMENDED-NEXT-MOVES

1. Operator finishes Netlify+Supabase wire-up.
2. Operator walks the PLAN.md verify checklist against the
   live deploy.
3. If clean: ship. If any stall: report the specific failure
   and the next session diagnoses + fixes.
4. Phase 5 holds for the operator to write MYCELIUM_NETWORK_SPEC.md
   or to greenlight the Carpenter drafting it.
5. The six follow-ups are available for any quiet slot;
   highest-leverage is the pre-commit library-seam audit
   script.

## OPERATOR'S-CURRENT-VIBE

Trusting, parallel-working on infra, high-velocity. The
"don't trust verify execute like a professional" framing has
been consistent across two big autonomous-work blocks. The
Carpenter has executed ten focused commits across this
session-day (the morning verify-pass plus the afternoon
autonomous block plus this evening's Phase 3 + 4 block plus
comms refreshes) with gates green throughout. The operator's
family-clock pressure remains the real schedule; the wallet
now exists in code ready for that first signed birth entry.
Next exchange will be either a Netlify-deploy outcome report
or a Phase 5/6 direction.

## Ideas ready to revisit

All earlier idea entries still hold. New observations worth
naming from this block:

- **The "math is the truth" demonstration shipped.** Phase 4
  is the most concrete user-facing proof that the wallet
  honors its thesis. The /verify route is also the only public
  surface the wallet exposes without auth — a third party can
  walk in, paste a proof, and the math checks out without any
  platform involvement. That's a load-bearing demo for the
  long arc; worth keeping the experience surface clean as
  later features touch it.

- **Bundle bloat continues monotonic** across blocks. Each
  feature adds ~1-2KB gz to one or more lazy chunks. Login
  surface still ~110KB gz holds. Bundle-audit before the next
  meaningful feature.

The 16+ earlier idea entries are stage-tagged in
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
