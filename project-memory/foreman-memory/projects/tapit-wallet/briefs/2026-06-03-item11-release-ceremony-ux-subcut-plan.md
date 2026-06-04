# Item 11 release-ceremony UX — sub-cut plan (2026-06-03)

> Status: PLAN, no code yet. Written at operator request ("plan the
> ceremony arc first") before cutting the architectural-core UX. Grounds
> against the actual repo: the item-11 CRYPTO SUBSTRATE is fully shipped
> + tested; only the ceremony UX is unbuilt. Companion to `PLAN.md` Tier
> 1 item 11, the equivocation/fork-resolution brief, and the
> captivation/growth brief. HEAD at writing: 20abbbc.

## What is already shipped (verified, do not rebuild)

`src/features/identity-gate/` (2847 lines incl. tests):
- **Envelope builders + readers + typeguards** for all FOUR kinds:
  `buildAttestReleaseAuthorityDraft`, `buildRevokeReleaseAuthorityDraft`,
  `buildImposterSignalDraft`, `buildReleaseAuthorityRequestDraft` — each
  with `read*` + `is*`. (releaseAuthorityEnvelopes.ts, 389 lines, tested.)
- **Identity-leaf credential primitive** (identityLeafCredential.ts) —
  the operator commits a leaf (e.g. vouching_circle, a spend-key
  commitment) as a self-signed credential; its envelopeId is the
  commitment the attestations bind to.
- **Verifier wrappers**: `verifyReleaseAuthorityBundle` (checks an M-of-N
  bundle of peer attestations composes against a leaf's policy +
  freshness) and `verifyGatedRelease` (the full gated-release check).
  Both tested.
- **Vouching-circle sign-on-save (sub-cut C.2)** — VouchingCircleSection
  is mounted in HomeScreen and already signs the vouching_circle leaf.

**Confirmed gap (grep): ZERO UI consumes the release-authority builders
or the verifier wrappers.** The ceremony that turns these primitives into
a usable flow is entirely unbuilt. That is this arc.

## The proven pattern to mirror (don't invent transport)

The recovery ceremony is the exact template — copy its shape:
- **Send**: `sendEnvelopeTo(transport, envelope, recipientPubkey, wallet)`
  (encryptedInbox.ts) pushes a signed envelope to a peer's inbox.
- **Receive + classify**: inbox envelopes arrive via the WalletProvider
  inbox subscription; `useInboxRouting.routeInbox(envelope, action,
  sender)` dispatches by action to a per-type modal. Existing actions:
  cosign-witness, absorb-cosign, membership-receive, vouch-witness,
  family-ratify, recovery-share-receive, recovery-request-respond.
- **Respond**: a per-type modal (e.g. RecoveryResponderModal) shows the
  request, gates on an explicit human check, signs the response, sends it
  back.
- **Collect + act**: the initiator modal (e.g. RecoveryInitiatorModal)
  subscribes for responses, accumulates to threshold, then composes.

The item-11 ceremony is the same loop with release-authority envelopes:
operator REQUESTS → peers RESPOND with attestations → operator COLLECTS
to M-of-N → operator PRESENTS the bundle to a verifier. Plus a sideband:
peers can fire an IMPOSTER-SIGNAL.

## Sub-cut sequence (smallest-useful, each independently landable)

### D0 — DESIGNATE a gated leaf (the true first cut — grounding caught this)
GROUNDING CORRECTION (2026-06-03): D1 (request attestations) is
meaningless without a gated leaf + policy to request FOR, and a grep
confirmed NO UI creates a `release_gate_policy` leaf today. So the real
first cut is designation: a surface where the operator names an
identity-leaf to gate (e.g. `dynasty_trust_spend_key`), picks the
eligible peers from their signed vouching circle, and sets the M-of-N
threshold + freshness horizon — signing a `release_gate_policy` leaf via
the shipped `buildReleaseGatePolicyLeafDraft`. Add a
`publishReleaseGatePolicyLeaf` helper mirroring `publishVouchingCircleLeaf`
(sign + hold + anchor). Deliverable: the operator can DESIGNATE a gate.
Self-contained; builder + reader (`findLatestReleaseGatePolicyLeaf`)
already shipped + tested. **This is the cut being built now.**

### D1 — Operator REQUEST surface — SHIPPED 2026-06-03
RequestVouchesModal: opened per designated gate from GatedLeafSection,
signs a `buildReleaseAuthorityRequestDraft` bound to the gate-policy
leaf's envelopeId and sends it to each eligible peer via context
`sendEnvelope`, with per-peer send status (summarizePublish). Additive-
proof copy applied. No collection yet (D3). Original spec below.

A surface (likely an Identity-tab section or modal) where the operator:
picks a gated identity-leaf, picks N peers from the vouching circle
(reuse `findVouchingCircleCandidates`), sets a horizon, and fires
`buildReleaseAuthorityRequestDraft` envelopes to each peer via
`sendEnvelopeTo`. Self-contained; builder already exists + tested.
Deliverable: the operator can ASK. No collection yet — that's D3.
Gate-safe: no new crypto, composes shipped builder + shipped transport.

### D2 — Peer RESPOND surface (the inbox half of D1) — SHIPPED 2026-06-03
envelopeRoute classifies an inbound release-authority-request to a new
`release-authority-respond` action; useInboxRouting dispatches it to
ReleaseAuthorityResponderModal (lazy), which walks an out-of-band
verification gate then signs `buildAttestReleaseAuthorityDraft` (bound to
the request's leaf envelopeId, honoring the proposed horizon) and sends it
back to the operator's identity pubkey. Mirrors RecoveryResponderModal.
HomeScreen budget bumped 24.5->25.5KB (routing edge only; modal is lazy).
Original spec below.


Add a `release-authority-request-respond` action to `routeInbox` + a
`ReleaseAuthorityResponderModal` mirroring RecoveryResponderModal: shows
"X asks you to attest they control leaf Y until date Z," gates on an
explicit human verification check (you know this is really X), then signs
`buildAttestReleaseAuthorityDraft` (binding to the leaf's envelopeId per
C.3) and sends it back via the inbox. Classify incoming via
`isReleaseAuthorityRequest`. Deliverable: a peer can one-tap ATTEST.

### D3 — Operator COLLECT + compose — SHIPPED 2026-06-03
Incoming attest-release-authority envelopes route to a new
`release-authority-collect` action that auto-holds + anchors them
(holdReleaseAuthorityAttest + acceptReleaseAuthorityAttest in
useInboxAccepts), so they persist and count. GatedLeafSection renders a
live per-gate tally via verifyReleaseAuthorityBundle (dedup-by-signer,
eligibility + freshness + leaf-binding enforced): "N of M vouched ·
resolved ✓". GatedLeafSection budget named at 4KB. Original spec below.


Extend the D1 surface to subscribe for inbound attestations, accumulate
distinct-peer attestations toward the leaf's M-of-N threshold, show
live "3 of 5 collected," and when threshold is met, compose the bundle
and run `verifyReleaseAuthorityBundle` to prove it resolves. Deliverable:
the operator sees the gate RESOLVE. Mirrors RecoveryInitiatorModal's
awaiting→combine phases.

### D4 — PRESENT the gated release — SHIPPED 2026-06-03
gatedReleaseBundle.ts: buildGatedReleaseBundle packages the signed policy
leaf + signed vouching-circle leaf + peer attestations + identity into a
shareable JSON; verifyGatedReleaseBundle re-roots BOTH leaves in the
identity's own signature (forged-policy/forged-circle rejection — 6 tests)
before running verifyGatedRelease. GatedLeafSection gains a "Present"
button on resolved gates (copies the bundle). VerifyProofScreen detects a
`bundle_type: gated_release` paste and renders a released/not-released
verdict with the honest-scope "proves peer-authorization, not truth"
framing. The public verifier path now does gated release too. Original
spec below.


The payoff: with a resolved bundle, `verifyGatedRelease` lets the
operator present the gated leaf (disclosure proof + the M-of-N bundle)
to a verifier — the same /verify-style surface, extended to check a
gated release. Deliverable: a third party can verify the operator was
peer-authorized to release leaf X. This is where the architectural core
becomes externally meaningful.

### F — IMPOSTER-SIGNAL sideband (can land any time after D2)
A peer-side "something's off about X" one-tap that signs
`buildImposterSignalDraft` and broadcasts to the operator's other
gate-peers (not public relays — gate-peer set only, per the spec). Plus
the operator-side surface that surfaces received imposter signals.
Deliverable: the network can SCREAM. Also the substrate the future
fork-resolution arc (equivocation brief) consumes.

### Revocation — SHIPPED 2026-06-03 (item 11 F, revocation half)
The responder now holds its own signed vouch. MyVouchesSection lists
"vouches you've given" with one-tap Withdraw → publishRevokeReleaseAuthority
(sign + hold + anchor) + send the revoke to the operator. envelopeRoute's
release-authority-collect + holdReleaseAuthorityAttest now accept revokes
too, so the operator holds them and the gate recompute
(verifyReleaseAuthorityBundle same-peer revoke-supersedes) drops the
voucher and the gate de-resolves. findMyGivenVouches (pure, 2 tests).
IMPOSTER-SIGNAL BROADCAST still pending: the builder exists but a true
multi-party "scream to the gate-peer set" delivery depends on the
gossip/Phase-B propagation layer — deliberately NOT faked here. Original
spec below.

### Revocation (small, fold into D2/D3)
`buildRevokeReleaseAuthorityDraft` — a peer withdraws a prior
attestation; a revoke immediately stales it so the gate stops resolving
until re-attestation or a different peer fills the threshold. Surface it
as a "withdraw my attestation" affordance wherever a peer can see what
they've attested to.

## Honest-scope notes (apply the doctrine)

- This proves PEER-AUTHORIZATION, not the operator's intent beyond it —
  the bundle says "M of N peers attested this identity may release leaf
  X," which is exactly the coercion/compromise protection claimed, and
  nothing more. Don't imply it prevents a willing operator from acting.
- The freshness horizon + revocation are what make it LIVE rather than a
  one-time stamp; the UX must show horizon + any staleness honestly.
- The imposter-signal is a social scream heard by the gate-peer set, not
  a truth verdict — same provenance-not-oracle guardrail.

## Recommended order & estimate

D1 → D2 → D3 → D4, with F and revocation folded in where natural.
Roughly 4–6 carpenter sessions; each sub-cut is independently
gate-green and landable. D1 is the smallest-useful entry point and the
right first cut. D4 is the one that makes the core externally legible and
is the natural pairing with the verify-page teaching surface (both extend
the public verifier path).
