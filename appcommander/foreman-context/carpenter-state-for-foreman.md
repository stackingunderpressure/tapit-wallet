# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running
manual against live Netlify + Supabase deploy. Dual-surface
comms active. v1 is shipped. Operator is on iOS.

---

## WHAT-CHANGED-RECENTLY

**MYCELIUM_NETWORK_SPEC.md written** — the Layer 3 spec of
record, branch `claude/compare-library-wallet-OW5FF`. This
discharges decision D-04 (Layer 3 not built until its spec
exists), so Phase 5 is now unblocked.

The spec was grounded by first reading the fleet doctrine
(`MYCELIUM.md`, `HEARTH_SPEC.md`, `HEARTWOOD.md`). It captures
the operator's People-network vision plus two chip decisions:

- **D-09 — graded verification tiers.** Every connection carries
  a signed leaf naming how it was verified: Tier R (remote
  link), Tier P (in-person handshake — QR/NFC, two phones
  together), Tier V (device-verified presence — biometric +
  geolocation + timestamp). A verifier always sees the tier.
- **D-10 — organizations + proof-of-place.** An organization
  (town, church, Legion) is a first-class entity that issues
  nested membership attestations. Proof-of-place works through
  membership, not an engineered residency feature. Single-key
  orgs first; quorum-key orgs (FROST/MuSig2) later. Supersedes
  the earlier "organizations fully deferred" framing.

Spec build phasing: 5a in-person handshake → 5b organizations +
membership → 5c Nostr transport → 5d device-verified presence →
5e hyphal lattice + social recovery. D-09/D-10 recorded in
decisions.md; PLAN.md Phase 5 updated to point at the spec.

No source code touched — a spec/doc session.

## Gates at session end

No gates run — documentation only. typecheck / lint / test
(19/19) / build last green at `66e9beb` (Capture Bridge Tier 1).
tapit-attest unchanged 82/78/0/4.

## WHAT'S-PENDING

1. **Operator reviews MYCELIUM_NETWORK_SPEC.md.** The operator's
   two chip answers were rich and expanded scope (organizations
   moved from deferred to core) — they should confirm sections
   4, 6, and 7 read their intent correctly before 5a is cut.
2. **Phase 5a — the in-person handshake.** The first Layer 3
   build slice: two wallets exchange identities via QR/NFC, each
   holds the other as a Tier P leaf, local only, no networking.
   Reuses the Phase 2.6 in-person co-sign primitives and the
   `relationship` attestation kind.
3. **Capture Bridge Tier 1b** — photo/file capture (POST share
   target + service-worker interception). Still Android-only;
   the operator is on iOS so this is low personal-verification
   value for them right now.
4. **Branch vs main:** main is behind — the operator declined a
   main push for the Android-only capture bridge (they are on
   iOS, can't test it). The branch has everything; a new session
   should use the branch. The capture-bridge + Mycelium-spec
   commits are branch-only by the operator's choice.
5. **v1.5:** native shell + App Store + iOS share extension —
   the iOS path for the capture bridge.
6. **Non-blocking follow-ups** unchanged.

## WHAT-TO-FLAG

**Phase 5 is unblocked.** The Mycelium spec exists; a future
Carpenter reads MYCELIUM_NETWORK_SPEC.md before any Layer 3 code.
The smallest first slice is Phase 5a, deliberately small and
local so first contact with reality is gentle.

**Tier V is the riskiest part of the spec.** Device-verified
presence leans on biometric (WebAuthn/passkey) and geolocation
behavior in an iOS PWA that may differ from assumptions — flagged
as an open question in the spec, not promised.

**The operator is on iOS** — this shapes priority. Web Share
Target work (capture bridge) is Android-only and the operator
can't field-test it; the Mycelium spec and Phase 5a are
platform-neutral and verifiable by the operator.

## RECOMMENDED-NEXT-MOVES

1. Operator reviews the Mycelium spec.
2. Cut Phase 5a — the in-person QR/NFC handshake (local only).
3. Phase 5b — organizations + membership.
4. Capture Bridge Tier 1b and v1.5 native shell when iOS
   capture becomes the priority.

## OPERATOR'S-CURRENT-VIBE

Deliberate and architectural. The operator asked for a
disciplined "chip me only where needed, then design the doc"
rhythm and it worked — two genuine decisions, the rest derived
from their thesis. They are thinking at the protocol level now,
shaping the network's deepest layer. Still holding the
verify-don't-trust line (mechanized as the grounding hook).
Expect next: spec-review feedback, or a go on Phase 5a.

## Ideas ready to revisit

All earlier idea entries hold. The Mycelium People-network
vision (ideas.md, 2026-05-22) has now matured into
MYCELIUM_NETWORK_SPEC.md — stage moves sprouting → fruiting body
(it became a buildable spec). The 2026-05-22 set otherwise
stands: capture bridge (Tier 1 shipped, Tier 1b pending),
web-proof authenticity, situations layer, records vault,
agent/Donna bridge. Full entries in
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
