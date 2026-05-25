# FROST-first quorum + charter governance roadmap (2026-05-25)

> Status: SKETCH for operator review. Supersedes the phasing
> direction of `2026-05-23-quorum-org-keys-roadmap.md` per
> operator-locked decisions from the 2026-05-25 chip-form
> direction session. The May 23 brief framed MuSig2 first with
> FROST as a follow-on; this brief reverses that ordering on
> operator direction ("Frost looks ripe then org governance
> structure"), and locks the four-phase shape A → B → C → D plus
> the canonical decisions that gate each.
>
> Companion to `MYCELIUM_NETWORK_SPEC.md` §6 (organization key
> governance), `HEARTWOOD.md` (higher-thresholds-for-higher-
> stakes principle), and the prior quorum brief whose Cut 5f-ii
> and Cut 5f-iii descriptions remain useful reference for the
> ceremony shape even though MuSig2 is replaced by FROST.

## What this finishes

`MYCELIUM_NETWORK_SPEC.md` §6 named two halves of organization
governance: **everyday issuance** (already shipped via cuts
5b-org-i through 5b-org-iii — declaration, officials roster,
ratifications view) and **constitutional acts** (rare,
high-stakes, true M-of-N threshold). This roadmap finishes the
second half AND delivers the governance shell on top so an
org's authority isn't a single key on a single device but a
quorum across the leaves of its own tree, governed by a charter
the org itself can amend.

## Operator-locked decisions (2026-05-25 chip session)

1. **FROST library: vendored**. Use a vetted Rust-via-WASM
   build of FROST-Secp256k1 (RFC 9591) into `tapit-attest`. No
   roll-our-own TypeScript implementation. Specific library
   selection is the one open sub-question below.

2. **Silent-objection deadlines: Bitcoin-block-anchored**. The
   admission window's deadline is measured by an OpenTimestamps
   confirmation reaching block N, not wall-clock. Sovereign
   clock matching the rest of the wallet's anchoring discipline.

3. **DKG rounds surface in inbox**. Outstanding distributed
   key generation rounds appear as inbox envelopes the operator
   can see they're holding up, routed through the existing 5c-i-ε
   inbox pattern Mycelium already uses for handshakes /
   memberships / recovery shares.

4. **Org tiers are creation-time choice**. No migration path
   needed because no orgs have been formed yet on production
   wallets. Single-key orgs (existing `createOrganization.ts`)
   stay in the codebase as the simpler tier; quorum-orgs ship
   as a new at-creation choice alongside. No in-place
   authority-transfer ceremony in scope.

5. **Charters are amendable via meta-governance**. An org can
   change its own charter (thresholds, official seats,
   objection-window length, etc.) via a constitutional act
   that meets the charter's current threshold for charter
   amendments. The validator enforces "higher-stakes-higher-
   threshold" — a charter that names dissolution as 5-of-5
   and routine issuance as 1-of-N is honoured.

## Why FROST first instead of MuSig2 first

The May 23 brief picked MuSig2 first because it's lighter
(N-of-N, simpler protocol, more mature library landscape) and
adequate for small founding boards. The May 25 reframe picks
FROST first for one structural reason: charter governance is
the headline goal, and charter governance needs different
thresholds for different actions (everyday issuance at 1-of-N,
roster changes at 3-of-5, dissolution at 5-of-5, charter
amendments at the strictest level the charter names). MuSig2's
N-of-N model can't express that — every signature requires
every signer. FROST's true M-of-N is the only shape that fits
the doctrine. Starting with MuSig2 would mean shipping
quorum-orgs that can't actually express the charter principle,
and then ripping it out for FROST later. Operator decision is
to skip that intermediate step.

## Open sub-question for operator

**Which FROST library do we vendor?** Three candidates worth
evaluating; the brief recommends I do this evaluation in Phase
A's first sub-task and present the chip back, but flagging the
shape now so the operator knows what's coming:

| Library | License | Bundle | Audit status | Notes |
| --- | --- | --- | --- | --- |
| `zcash/frost-secp256k1` (Rust → WASM) | MIT/Apache | ~150-250KB gz est. | Audited by NCC Group 2023 | Reference implementation. Heaviest. RFC 9591 native. |
| `frostlib` (TS) | MIT | ~30-50KB gz est. | Self-audit, no third-party | Maintained by paulmillr-adjacent contributors. Lighter, untested in third-party audit. |
| `cmdcode/frost` (TS) | MIT | ~40-60KB gz est. | Self-audit | Same author as `cmdcode/musig2` which the May 23 brief considered. Maintained but small community. |

Decision deferred to Phase A; if the operator has a strong
prior they can lock it now via a follow-up chip question.

## The four phases (in order)

### Phase A — FROST primitives in `tapit-attest`

Library cut. No wallet-side code. Bumps `tapit-attest` to
`0.2.0-wallet.0` (minor version bump because new public API).
Adds:

- `frost.dkg.round1(participantId, threshold, n)` → secret
  package + round-1 broadcast
- `frost.dkg.round2(round1Packages)` → secret share + group
  public key
- `frost.sign.round1(secretShare)` → signing nonce + commitment
- `frost.sign.round2(signingPackage, secretShare, nonce)` →
  signature share
- `frost.sign.aggregate(signatureShares, signingPackage)` →
  Schnorr signature verifiable under the group public key
- Test suite against IETF RFC 9591 test vectors (must
  round-trip 100% before this phase ships)
- The aggregate signature output is byte-identical to a
  BIP340 Schnorr signature, so `verifySignature` in
  `keys.ts` works against it unchanged

Phase A is gated by the FROST library decision above. I do
the evaluation as Phase A's first work, present a chip-form
recommendation to the operator, lock it, then implement.
About one focused library session.

### Phase B — Wallet quorum scaffolding

New `quorum` feature folder in `src/features/quorum/`. Wallet
gains the role of "participant in a multi-party key" without
yet knowing what the key is FOR. Ships:

- `manifest.ts` declaring the feature
- `QuorumParty` type — pubkey + role + share + commitments
- `QuorumDkgCeremonyModal` — UI for a multi-party DKG round
  the operator participates in. Walks through: pick the other
  M-1 participants via PeerPicker (must all be Mycelium-
  reachable), enter the threshold, run round-1 nonces over
  Mycelium, run round-2 share generation, persist the
  resulting share encrypted under passphrase in IndexedDB
- `QuorumSigningCeremonyModal` — UI for a multi-party signing
  round on a tapit-attest envelope; runs FROST round-1 +
  round-2 across the M participants
- `inboxEnvelopeHandler.ts` extension: a new route type
  `dkg-round` and `signing-round` that auto-routes incoming
  ceremony packets to the matching ceremony modal
- Persistence: shares + group pubkey + roster live in the
  encrypted wallet snapshot same as everything else

Half a session for scaffolding + DKG ceremony; half a session
for signing ceremony + inbox routing. About one operator
session total.

### Phase C — Quorum-controlled organizations (dual-tier)

UI cut. Extends `createOrganization.ts` to ship two creation
paths:

- **Single-key org** (existing code) — declaration signed by
  the operator's own wallet, officials roster + ratifications
  as today. The simpler tier any operator can spin up alone.
- **Quorum-controlled org** (NEW) — creation triggers a
  Phase B DKG ceremony with the named officials. The resulting
  FROST group public key IS the org's identity (subject of the
  self-declaration credential). No single device holds the org's
  authority; the officials' shares collectively reconstitute it
  when a signing ceremony meets threshold.

Both tiers issue memberships through the same envelope shape;
the difference is the signature on the membership credential —
single-key orgs use the operator's key, quorum-orgs use the
aggregated FROST signature from a signing ceremony. Existing
ratifications view shows N-of-M for everyday issuance
ratifications; quorum-orgs ALSO render their charter threshold
inline ("this credential signed at threshold 1-of-5, ratified
by 4 of 5 officials").

About two operator sessions: one for the dual-tier creation
flow, one for the membership-issuance signing path.

### Phase D — Charter governance

New `governance` feature folder. Ships the charter attestation
type, the silent-objection admission flow, and the meta-
amendment machinery.

**Charter attestation** — a new credential-kind attestation
the org signs at creation declaring per-action thresholds:

```
charter:
  routine_issuance: { threshold: 1, ratification_floor: 0.5 }
  roster_change:    { threshold: 3 }  # of officials
  key_rotation:     { threshold: 4 }
  dissolution:      { threshold: 5 }  # i.e. unanimous if 5 officials
  charter_amend:    { threshold: 5 }  # the strictest, per operator decision
  objection_window: { blocks: 144 }   # ~24h at 10min/block
```

Validator enforces higher-stakes-higher-threshold ordering
(charter_amend ≥ dissolution ≥ key_rotation ≥ roster_change ≥
routine_issuance). The charter is itself a signed envelope; its
own threshold for amendment is read from the in-force charter
at amendment time.

**Silent-objection admission** — alternative to running a full
signing ceremony for new-member admission. Flow:

1. Any official proposes a new member by signing a
   `member_proposal` credential naming the candidate.
2. The proposal envelope's `objection_deadline` field is set
   to `current_btc_block_height + charter.objection_window.blocks`.
3. The proposal is published via Mycelium; every official's
   wallet receives it as an inbox envelope routed to
   `proposal-review`.
4. Officials who object sign an `objection` envelope referencing
   the proposal's envelopeId before the deadline.
5. Anchoring worker watches the proposal's deadline-block; once
   that block confirms via OpenTimestamps, the validator counts
   the objections. If fewer than `charter.objection_threshold`
   officials objected, the proposal is admitted and the
   candidate becomes a member without a full signing ceremony.
6. If objections meet threshold, the proposal fails silently.

The block-anchored deadline is the load-bearing piece: no
device's wall-clock matters, the deadline triggers exactly when
a real Bitcoin block confirms via OpenTimestamps. Same anchoring
worker that powers journal-entry "verified at block N" handles
this.

**Charter amendment** — a constitutional act that proposes a new
charter, signed via a Phase B signing ceremony at the in-force
charter's `charter_amend` threshold. The new charter envelope's
`replaces` field points at the previous charter's envelopeId;
the validator walks the chain at verification time and uses the
most-recent confirmed charter.

About two-to-three operator sessions for charter type + validator,
silent-objection flow + anchoring deadline, and charter-amendment
ceremony.

## What is NOT in this roadmap

Carrying forward exclusions from `2026-05-23-quorum-org-keys-
roadmap.md`:

- **MAST policy trees** — different per-action thresholds live
  in the charter attestation, not in on-chain Bitcoin script.
- **On-chain Bitcoin signing** — quorum signs tapit-attest
  envelopes; anchoring those envelopes is already shipped.
- **Quorum-recovery for compromised shares** — Phase 5e Shamir
  cascade is the existing recovery story; Phase 8 assumes it.

Also out of scope for this roadmap:

- Voting beyond binary signature aggregation (ranked-choice
  internal elections, weighted votes by stake). Charter
  thresholds are integer counts of officials' signatures.
- Cross-org federation governance (one quorum-org joining
  another). Mentioned in MYCELIUM_NETWORK_SPEC §6 as a
  "constitutional act type"; the envelope shape supports it
  but the multi-org UX is a follow-on.

## Prerequisites + risk surface

- **Bundle weight.** Phase A's vendored FROST is the heaviest
  single addition the wallet has ever made. The selected library
  may need to be lazy-loaded only into quorum-aware screens so
  Classic single-key operators never pay the bytes.
- **Mycelium transport must be on** for Phase B/C/D ceremonies.
  The existing `prefs.nostrTransportEnabled` gate covers this;
  the QuorumDkgCeremonyModal surfaces a "needs Mycelium on" hint
  the same way the unified Handshake Start page does.
- **Test vector compliance** is non-negotiable for Phase A. The
  IETF RFC 9591 reference vectors must 100% round-trip before
  any wallet code depends on FROST primitives. Pattern: same
  approach `tapit-attest`'s `splitSecret` already uses for
  Shamir test vectors.
- **Charter validator complexity.** The threshold-ordering
  rule, the amendment chain walker, and the silent-objection
  deadline check are real cryptographic-policy code. Build with
  fuzz tests, not just example tests.

## Estimated calendar

| Phase | Sessions | Calendar |
| --- | --- | --- |
| A — FROST primitives + library decision | 1-2 | 1 week |
| B — Wallet quorum scaffolding | 1 | 1 week |
| C — Quorum-controlled organizations | 2 | 2 weeks |
| D — Charter governance | 2-3 | 2-3 weeks |
| **Total arc** | **6-8 sessions** | **~6-7 weeks** |

The arc is roughly the same calendar as the Fresh young-adult
roadmap. Each phase ships independently usable; the operator
can pause between phases without leaving the wallet in an
inconsistent state.

## Approval gate

Operator approves this brief → I write the canonical `decisions.md`
entry recording the five locked answers, then cut Phase A's first
sub-task (library evaluation chip) in the next dispatch. The
2026-05-23 brief stays in the briefs folder as historical context
but is functionally superseded by this one.
