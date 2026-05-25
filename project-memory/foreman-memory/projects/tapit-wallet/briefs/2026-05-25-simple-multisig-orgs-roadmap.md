# Simple-multisig orgs roadmap (2026-05-25, evening session)

> Status: SKETCH for operator review. Supersedes the phasing
> direction of both `2026-05-23-quorum-org-keys-roadmap.md` AND
> `2026-05-25-frost-first-and-charter-governance-roadmap.md` per
> operator-locked decision from the 2026-05-25 evening chip-form
> session ("regular multisig and not a complicated frost where
> the complexity is overwhelming us, but we still have an
> organization controlled by more than one key").
>
> The two superseded briefs both placed novel cryptographic
> primitives (MuSig2 then FROST) ahead of the org-control use
> case the operator actually wants to ship. This brief reverses
> the priority: ship multi-key org control THIS WEEK using the
> list-of-signatures primitives already in the wallet, and keep
> FROST in the brief drawer as an optional later privacy upgrade
> for orgs that specifically need aggregate-signature anonymity.
>
> Companion to `MYCELIUM_NETWORK_SPEC.md` §6 (organization key
> governance) and `HEARTWOOD.md` (higher-thresholds-for-higher-
> stakes principle). The May 23 and May 25-morning briefs stay
> in the briefs folder as historical context.

## What this finishes

`MYCELIUM_NETWORK_SPEC.md` §6 named two halves of organization
governance: **everyday issuance** (already shipped via cuts
5b-org-i through 5b-org-iv — declaration, officials roster,
ratifications view, membership-chain walker) and **constitutional
acts** (rare, high-stakes, true M-of-N threshold). This roadmap
finishes the second half on the existing list-of-signatures
substrate AND delivers a small charter shell on top so an org's
authority isn't a single key on a single device but a quorum of
named officials' signatures merged onto a single envelope.

## The surprise

Most of this is already in the wallet. The grounding pass for
this brief confirmed that the path-of-least-resistance multisig
substrate is shipped, tested, and in production use today for
witness-cosign and custody-handoff. The pieces:

- `src/features/cosigning/mergeSignatures.ts` — merges N
  independent secp256k1 signatures on a single envelope by
  `envelopeId`, dedupes by `(signer, sig)`, re-verifies the
  merged result, throws if no surviving signature verifies.
  Generic multi-sig primitive.
- `src/features/cosigning/CosignRequestModal.tsx` +
  `CosignAsWitnessModal.tsx` + `AbsorbCosignModal.tsx` —
  three-modal pipeline that requests a co-signer's signature,
  collects it, absorbs the return blob back into local
  holdings via `mergeSignatures`.
- `src/features/connections/createOrganization.ts` —
  `countRatifications(envelope, officials)` cross-references
  an envelope's signatures against the latest officials
  roster and returns `{ total, ratified, byName }`. Used by
  `RatificationsBadge` today as a decorative N-of-M chip.
- `src/features/connections/createOrganization.ts` —
  `publishOfficialsRoster` snaps a new full roster envelope
  on every edit; latest-by-`issuedAt` wins. Roster-update
  story is already done.
- `src/features/connections/OfficialsEditorModal.tsx` —
  add / remove officials inline.

The doctrine comment at `createOrganization.ts:201-213` already
describes the pattern verbatim: "Officials then co-sign that
membership later from their personal wallets using the existing
CosignAsWitness + Absorb + Send-back machinery — no new flow
needed; the multi-signature envelope just accumulates
ratifications."

What's missing is mechanical, not cryptographic: a `threshold`
leaf on the org self-declaration, a verifier rule that flips
`countRatifications` from informational to required, a
multi-fanout variant of `CosignRequestModal` that ships the
envelope to several officers at once, and — for the
charter-governance ask — a per-action thresholds leaf so
different org actions can require different ratification counts.

## Operator-locked decision (2026-05-25 evening chip session)

Operator chose "Simple multisig now" over "Stay FROST-first" /
"Both in sequence" / "Write the simple-multisig brief first"
after this brief's primitive-inventory was surfaced in chat.
The directional decision recorded:

- **Cryptographic substrate**: list-of-signatures, not FROST,
  not MuSig2. N independent secp256k1 signatures on the
  envelope, verifier counts ≥M of the N declared officials.
- **No vendored crypto**: zero new dependencies. The existing
  `verifyEnvelope` + `signEnvelope` from tapit-attest cover
  every signature operation in scope.
- **No DKG ceremony**: there is no shared private key to
  generate. The org's IDENTITY is the founder's self-declaration
  pubkey; the org's CONTROL is the roster + threshold.
- **No tapit-attest version bump**: this roadmap adds zero
  new public API surface to the library. All new code lives
  in `src/features/connections/` and `src/features/cosigning/`.
- **FROST stays in the drawer**: the
  `2026-05-25-frost-first-and-charter-governance-roadmap.md`
  brief is not deleted. It remains the canonical reference for
  the day a quorum-org needs signer-anonymity (which is not
  today, may not be ever for this product's user base).

## Why list-of-signatures over FROST

Three reasons in order of weight.

1. **Time to first multi-key org.** Counted in days, not months.
   The substrate exists; the deltas are UI plumbing on tested
   primitives. The FROST path requires vendoring a Rust-via-WASM
   library, passing RFC 9591 reference vectors, bumping
   tapit-attest to `0.2.0-wallet.0`, and building DKG + signing
   ceremony modals before the first quorum-org can exist. Six
   to seven weeks per the FROST brief's estimate.

2. **Per-action thresholds work natively.** The FROST brief's
   load-bearing argument against MuSig2 was that "MuSig2's
   N-of-N model can't express different thresholds for different
   actions." That argument doesn't apply to list-of-signatures
   at all: the verifier reads the charter's per-action
   threshold, counts how many distinct officials' signatures
   appear on the envelope, and compares. Membership credentials
   at 2-of-5, expulsions at 3-of-5, charter amendments at 4-of-5
   all fall out of the same primitive.

3. **Signer transparency is a feature, not a bug.** With
   list-of-signatures, a verifier sees WHICH officials signed,
   not only THAT the org signed. For human organizations
   governing themselves on a sovereign identity wallet, knowing
   who ratified an act is exactly the kind of transparency that
   makes governance auditable. The FROST aggregate-signature
   property hides signer identity — useful for some institutions
   (whistleblowers, dissident orgs) but counterproductive for
   most (community boards, family trusts, professional
   associations). When an org someday needs signer-anonymity,
   they upgrade to FROST as a creation-time choice; the May 25
   morning brief is preserved for that day.

## Honest trade-offs versus FROST

- **Signature size grows linearly with N.** Each official's
  signature is a separate ~64-byte secp256k1 sig in the
  envelope's `signatures` array. A 5-of-7 quorum membership
  carries up to 7 sigs vs FROST's single aggregate sig.
  Non-issue for attestation envelopes since the wallet is
  not space-constrained the way Bitcoin transactions are;
  envelopes already routinely carry one to three signatures.
- **The "org pubkey" is asymmetric.** Org IDENTITY (the
  pubkey other wallets reference as "this org") is the
  founder's self-declaration pubkey, which is a real
  keypair held by the founding device. Org CONTROL is the
  roster + threshold + the officials' independent keys.
  This asymmetry takes one short paragraph to explain in
  the UI but is structurally honest about how human
  organizations actually work: an institution's identity
  is its founding act; its control is its current officers.
- **The founder's key is a soft single point of failure
  for org IDENTITY (not control).** If the founder loses
  their key, the org's public identity becomes unrenewable
  — new memberships can still be issued by the officials
  (because issuance is roster-controlled) but the
  "founding declaration" cannot be re-signed. Mitigation:
  the founder backs up via Phase 5e Shamir cascade like
  every other operator, and the v2 of this roadmap can add
  a `successor_founder` charter clause that lets officials
  collectively re-declare the org under a new founding key
  if the original is lost. Out of scope for v1; noted.

## The four phases (in order)

### Phase A — Threshold leaf + verifier gate

Smallest possible cut. No UI yet. Extends the org
self-declaration envelope shape and adds the verifier rule.
Ships:

- New leaf on `selfDeclareOrganization`: `threshold: M` where
  `1 <= M <= roster.length`. Default `1` (preserves today's
  single-key org behaviour exactly — no migration needed for
  the zero orgs currently in production).
- New helper `isOrgRatified(envelope, roster, threshold) →
  boolean` in `createOrganization.ts` that returns true iff
  `countRatifications(envelope, roster).ratified >= threshold`.
- Tests covering: threshold=1 single-key org behaves as today;
  threshold=2 org's membership credential is not ratified
  until two distinct officials sign; duplicate signatures
  from the same official count once; signatures from non-roster
  pubkeys are ignored.
- `RatificationsBadge` gains a `required` prop; renders the
  tone scale already in place (neutral / amber / emerald) but
  with the threshold as the emerald floor instead of the
  full-roster count.

About one focused session. No new files; deltas inside
`createOrganization.ts` + a test file + a small badge prop
change.

### Phase B — Multi-fanout cosign request

UI cut. Generalizes `CosignRequestModal` from one-witness-at-a-time
to multi-officer-fanout. Ships:

- `CosignRequestModal` gains a recipient picker that defaults
  to "all officials of org X" when the envelope is an org-issued
  credential. Operator can de-select any subset.
- The QR / paste / Mycelium-send paths each produce one envelope
  per recipient (envelopeId stays constant; recipient address
  varies) so each officer's `CosignAsWitnessModal` opens the
  same envelope under their key.
- `AbsorbCosignModal` already handles merging multiple returns
  via `mergeSignatures` — no change needed there; just runs
  multiple times as officials send back.
- Optional: progress indicator on the source envelope's card
  showing "3 of 5 officials ratified" while ratifications
  trickle in.

Half a session for the fanout UI, half for the progress
indicator. About one session total.

### Phase C — Quorum-controlled organizations at creation time

UI cut. Extends the org-self-declaration flow in
`SettingsScreen` (or wherever today's "I am an organization"
toggle lives — grounding pass needed at cut time to confirm
the exact entry point) to ship the threshold choice up front:

- Creation form gains a "Decisions require ___ of ___
  officials" field next to the org name.
- Initial roster can be added inline at creation time (currently
  added later via `OfficialsEditorModal`). Threshold validates
  against initial roster size.
- A single-key org (threshold=1, founder also on roster) and a
  quorum org (threshold>1, founder optionally on roster) come
  out of the same flow. The flow is honest about the IDENTITY
  vs CONTROL asymmetry in one paragraph of inline help.

About one session.

### Phase D — Charter governance via charter attestation

New attestation type (still credential-kind under the hood, no
new tapit-attest kind needed). The charter is itself an envelope
the org signs declaring per-action thresholds. Ships:

- `publishCharter(wallet, ownerId, anchorWorker, thresholds)`
  in `createOrganization.ts` (or a new `createCharter.ts`
  sibling — TBD at cut time based on file-size headroom).
- Charter envelope carries leaves: `routine_issuance`,
  `roster_change`, `key_rotation`, `dissolution`, `charter_amend`.
  Each is an integer threshold. Validator enforces
  higher-stakes-higher-threshold ordering:
  `charter_amend >= dissolution >= key_rotation >=
  roster_change >= routine_issuance`.
- `findLatestCharter(holdings, orgIdentity)` — latest-by-`issuedAt`
  with the org's own signature, same shape as
  `findLatestOfficialsRoster`.
- `isOrgRatified` from Phase A extended to read the action
  type off the envelope and apply the matching threshold from
  the latest charter. Default threshold (no charter) stays the
  declaration's top-level `threshold`.
- Charter amendment is just publishing a new charter; the new
  envelope must be ratified at the in-force charter's
  `charter_amend` threshold to take effect. The validator
  walks the chain at verification time and uses the most-recent
  RATIFIED charter, not the most-recent SIGNED one (this is the
  one subtle bit; test it carefully).

The block-anchored silent-objection admission flow from the
FROST brief is OUT OF SCOPE for this roadmap. It is a real
governance primitive but it depends on the anchoring worker
detecting deadline-block confirmations via OpenTimestamps, which
is its own cut. Listed in "What's NOT in this roadmap" below
with a note that it can be layered on later without changing the
substrate this brief lays.

About one to two sessions.

## What is NOT in this roadmap

- **FROST / aggregate signatures / signer anonymity.** Deferred
  to a future opt-in tier per the
  `2026-05-25-frost-first-and-charter-governance-roadmap.md`
  brief, which is preserved for that day. Orgs that need signer
  anonymity can be added as a third tier alongside single-key
  and list-multisig once there is a real use case demanding it.
- **Silent-objection admission with block-anchored deadlines.**
  Real primitive, depends on anchoring worker plumbing not yet
  in place. Can layer on top of the list-multisig substrate
  later without any breaking change.
- **MAST policy trees / on-chain Bitcoin multisig.** Same as
  the FROST brief: out of scope, different layer.
- **In-place migration from single-key to quorum org.** No
  orgs currently exist on production wallets; creation-time
  choice is sufficient. If migration becomes necessary later,
  the founder publishes a new self-declaration with
  `threshold>1` and the latest roster, and verifiers
  honour the most-recent declaration.
- **Cross-org federation governance.** Same as the FROST brief:
  Mycelium spec mentions it, multi-org UX is a follow-on.
- **Voting beyond binary signature aggregation.** Charter
  thresholds are integer counts of officials' signatures. No
  ranked-choice, no weighted votes by stake.

## Prerequisites + risk surface

- **No new dependencies.** This is the headline. Every primitive
  this roadmap needs is already in `tapit-attest` or
  `src/features/cosigning/`. Bundle weight delta is measured in
  tens of lines, not kilobytes.
- **Mycelium transport for multi-fanout cosign requests in
  Phase B.** Same precondition as the existing witness-cosign
  flow; the modal already surfaces the "needs Mycelium on"
  hint where applicable.
- **Verifier-rule correctness is the main risk.** The
  threshold gate is the load-bearing check for every claim a
  quorum org will ever make. Phase A's test suite must cover
  duplicate-signature collapse, non-roster signature rejection,
  threshold-greater-than-roster-size rejection at creation
  time, and the boundary case where a roster shrinks below an
  in-force threshold (decision: in-force threshold is capped
  at current roster size when evaluating; test it).
- **Charter validator ordering rule in Phase D** needs the
  same fuzz-test discipline the FROST brief called out. The
  threshold-monotonicity constraint
  (`charter_amend >= dissolution >= ...`) prevents footguns
  but the test cases need to enumerate them.

## Estimated calendar

| Phase | Sessions | Calendar |
| --- | --- | --- |
| A — Threshold leaf + verifier gate | 1 | 1-2 days |
| B — Multi-fanout cosign request | 1 | 2-3 days |
| C — Quorum-controlled orgs at creation time | 1 | 2-3 days |
| D — Charter governance | 1-2 | 3-5 days |
| **Total arc** | **4-5 sessions** | **~1.5-2 weeks** |

Roughly one-quarter the calendar of the FROST roadmap. The
arc is dominated by UI plumbing on tested primitives, not
cryptographic engineering. Each phase ships independently
usable; the operator can pause between phases without leaving
the wallet in an inconsistent state.

## Approval gate

Operator approves this brief → I write the canonical
`decisions.md` entry recording the substrate choice (list-of-
signatures over FROST) and the four-phase shape, then cut
Phase A's first sub-task (threshold leaf + `isOrgRatified`
helper + tests) in the next dispatch. The
`2026-05-25-frost-first-and-charter-governance-roadmap.md`
brief stays in the briefs folder as historical context AND as
the canonical reference for the day a future opt-in
aggregate-signature tier is needed; it is functionally
superseded for the immediate org-control problem but preserved
verbatim as the FROST upgrade path.
