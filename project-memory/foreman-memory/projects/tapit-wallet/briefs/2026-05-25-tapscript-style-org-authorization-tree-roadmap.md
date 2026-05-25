# Tapscript-style org authorization tree roadmap (2026-05-25, late evening)

> Status: SKETCH for operator review. Supersedes the phasing
> direction of all three prior org-control briefs:
>
> - `2026-05-23-quorum-org-keys-roadmap.md` (MuSig2-first)
> - `2026-05-25-frost-first-and-charter-governance-roadmap.md` (FROST-first)
> - `2026-05-25-simple-multisig-orgs-roadmap.md` (list-of-Schnorr-signatures)
>
> All three remain in the briefs folder as historical context. The
> May 25 evening session walked the operator from list-of-sigs to
> Tapscript-style after the operator asked whether what was briefed
> actually was "Taproot multisig" and whether the wallet's leaves
> theory held up. The honest answer surfaced that what had been
> briefed was list-of-Schnorr-sigs, NOT Taproot script-path multisig,
> and that the wallet's existing leaf-tree primitive (Phase 4
> selective disclosure) is the EXACT cryptographic shape needed to
> port Taproot's script-path Merkle-tree-of-conditions model to
> off-chain attestation envelopes. This brief lays out that port.
>
> Companion to `MYCELIUM_NETWORK_SPEC.md` §6 (organization key
> governance), `HEARTWOOD.md` (higher-thresholds-for-higher-stakes
> principle), and the canonical Bitcoin reference BIPs 341/342.

## What this finishes

`MYCELIUM_NETWORK_SPEC.md` §6 named two halves of organization
governance: **everyday issuance** (already shipped via cuts
5b-org-i through 5b-org-iv) and **constitutional acts** (rare,
high-stakes, true M-of-N threshold authorization, ideally
private until invoked, ideally composable via amendment). This
roadmap finishes the second half by porting Bitcoin Taproot's
script-path multisig SHAPE — a Merkle-committed tree of
alternative authorization conditions, with selective reveal of
the satisfied condition at action time — to off-chain
`tapit-attest` envelopes, on top of the wallet's existing
leaf-tree primitive.

## The substrate insight

The wallet already has the EXACT cryptographic primitive needed,
shipped and tested as Phase 4 selective disclosure. Grounding
pass for this brief read `tapit-attest/src/core/field-tree.ts`
end-to-end and confirmed:

- `treeFromObject(name, obj)` already builds a Merkle tree of
  named leaves from a plain object. Nested objects become
  branches; scalars become leaves.
- `disclosureProof(attestation, leafPath)` already produces a
  proof bundle revealing one leaf plus a sibling-hash path from
  that leaf up to the claim root.
- `verifyDisclosureProof(proof)` already reconstructs the claim
  root from the disclosed leaf plus the path, recomputes the
  canonical attestation digest, and runs the carried signatures
  against it.
- `multiDisclosureProof` and `verifyMultiDisclosureProof`
  already amortize the proof across N leaves via a pruned
  Merkle multi-proof.

This is structurally identical to Taproot's script-path spending
verification:

| Taproot script-path | tapit-attest selective disclosure |
| --- | --- |
| Output commits to Merkle root of script leaves | Attestation commits to Merkle root of field leaves |
| Spend reveals one script + control block | Disclosure reveals one leaf + sibling-hash path |
| Verifier reconstructs root from script + path | Verifier reconstructs root from leaf + path |
| Verifier runs witness against the revealed script | Verifier runs signatures against the reconstructed digest |

The Tapscript-style organizational authorization tree is a
generalization of the same primitive to a different KIND of
leaf: where Phase 4 leaves carry FACTS (`birthday`,
`citizenship`, `employer_name`), governance leaves carry RULES
(`{action: "routine_issuance", threshold: 1, eligible: [...]}`).
The cryptographic machinery is unchanged.

## Operator-locked decisions (2026-05-25 evening chip sessions)

1. **Substrate: Tapscript-style leaf tree, not list-of-sigs,
   not FROST.** The org's authority is a Merkle commitment to a
   tree of authorization-rule leaves; an org-issued envelope
   carries a disclosure proof of one leaf (the rule being
   satisfied) plus signatures from the eligible signers named
   in that leaf.

2. **Auth-tree home: sub-branch of the claim tree.** Each
   authorization rule is a regular field-tree leaf inside the
   org self-declaration's existing claim structure (under a
   sub-branch called `auth`). Each authorization proof is a
   regular disclosure proof produced by the shipped
   `disclosureProof` function with the same domain-separated
   hashes. Zero new cryptographic code in `tapit-attest`. No
   library version bump.

3. **No FROST, no MuSig2, no DKG.** Every signature on every
   envelope remains an independent BIP340 Schnorr signature.
   The Tapscript-style aspect is purely structural — a Merkle
   tree of rules — not an aggregate-signature scheme.

4. **No tapit-attest version bump.** This roadmap adds zero
   new public API surface to the library. All new code lives in
   `src/features/connections/` and a new
   `src/features/governance/` folder.

5. **FROST and list-of-sigs briefs stay in the drawer.** Both
   prior briefs are preserved verbatim as alternative
   substrates: list-of-sigs as the simpler fallback if
   Tapscript-style proves too heavy in practice, FROST as the
   day-the-org-needs-signer-anonymity upgrade. Neither is
   deleted; both are functionally superseded for the immediate
   org-control problem.

## Why Tapscript-style over list-of-sigs

The list-of-sigs brief (earlier today) would have shipped
multi-key org control by flipping `countRatifications` from a
decorative badge to a verifier gate plus adding a top-level
`threshold` leaf to the org self-declaration. Simpler, faster
to ship, perfectly adequate for an org with a single uniform
threshold. The Tapscript-style approach adds three properties
the list-of-sigs approach cannot:

1. **Per-action thresholds without a separate charter type.**
   The charter IS the auth-tree. Each rule leaf is one
   `{action, threshold, eligible}` triple, and there can be as
   many as the org wants — routine_issuance at 1-of-5,
   expulsion at 3-of-5, charter_amendment at 4-of-5,
   dissolution at 5-of-5 — all sitting in the same Merkle tree,
   committed by the same self-declaration. No new attestation
   type for the charter; the charter is just a sub-branch in
   the self-declaration's claim tree.

2. **Privacy of the unused rules.** A verifier seeing a
   routine membership credential learns ONLY the
   routine_issuance rule (via the disclosure proof); the
   dissolution rule, the charter-amendment rule, the
   expulsion rule all stay private until each is actually
   invoked. The org's full governance structure is hidden
   until it's exercised, exactly as Taproot's unused
   script-leaves stay private until they're spent under.

3. **Eligible-signer subsets per rule.** A rule's `eligible`
   list does not have to be the full roster. The
   `routine_issuance` rule might be `eligible: [all officers]`
   while the `treasury_disbursement` rule is
   `eligible: [treasurer, secretary]` and the `dissolution`
   rule is `eligible: [founder, all officers]`. The
   list-of-sigs substrate can't express this without a layer
   of role machinery; the Tapscript-style substrate gets it
   for free because each leaf names its own eligible set.

The cost is one disclosure-proof bundle per org-issued envelope
(small — one leaf plus log(rules) sibling hashes) and a slightly
more involved verifier that runs `verifyDisclosureProof` then
counts eligible signatures.

## Honest trade-offs

- **Envelope size grows modestly per org-issued envelope.** A
  disclosure-proof bundle is the disclosed leaf (a few hundred
  bytes for a typical rule) plus log(N) sibling hashes (32
  bytes each). For a 10-rule auth-tree, the proof is ~500
  bytes. Non-issue.
- **Verifiers need access to the org's self-declaration to
  check the auth-proof's root commitment.** Same precondition
  as today's membership verification (verifiers need the
  org's roster); the disclosure proof carries the meta-fields
  and signatures inline, so the verifier holds the
  self-declaration in their wallet's known-orgs list rather
  than fetching at verify time.
- **Auth-tree updates require a new self-declaration.** If the
  org changes its rules, it publishes a new self-declaration
  with a new auth_root. The new self-declaration must itself
  be authorized by the OLD self-declaration's
  `charter_amendment` rule — meaning the new declaration
  carries a disclosure proof of the old declaration's
  `charter_amendment` rule plus signatures meeting that
  threshold. The verifier walks the chain of self-declarations
  back to the founding one, validating each transition. (This
  is exactly how Taproot UTXO chains express governance
  amendments — re-spend to a new output with a new committed
  tree.)
- **The auth-tree-as-sub-branch lives inside the same claim
  tree as the org's display fields (`org_name`, `pubkey`,
  `credential_type`).** This means the org's self-declaration
  digest commits to BOTH the display fields AND the auth-tree
  root in a single signature. Clean from a verification
  standpoint; one subtle implication is that publishing a new
  auth-tree always means publishing a new full
  self-declaration (you can't update just the auth sub-branch
  in place). Fine — the chain-walk pattern handles this.
- **The list-of-sigs path remains the fallback.** If at any
  point during implementation the Tapscript-style approach
  proves heavier than expected, the list-of-sigs brief is on
  disk and can be picked up where this one leaves off.

## The four phases (in order)

### Phase A — Auth-rule type + selfDeclareOrganization extension

Smallest possible cut. Pure wallet-side. No tapit-attest changes.
Ships:

- New type `AuthRule = { action: string; threshold: number;
  eligible: readonly string[] }` in
  `src/features/connections/createOrganization.ts` (or a new
  `src/features/governance/authRule.ts` sibling — file-size
  headroom decides at cut time).
- `selfDeclareOrganization` gains an `authRules: readonly
  AuthRule[]` parameter. Default is a single rule
  `{ action: "routine_issuance", threshold: 1, eligible:
  [wallet.identity] }` so existing-shaped declarations keep
  working without change.
- The rules become a sub-branch named `auth` in the claim
  tree, with each rule as a leaf named by its action and
  value-encoded as canonical JSON of `{threshold, eligible}`.
- Helper `findAuthRule(orgSelfDecl, action) →
  { rule, path } | null` returns the rule plus its slash-
  delimited path inside the claim tree (e.g.
  `auth/routine_issuance`).
- Helper `proveAuthorization(orgSelfDecl, action) →
  DisclosureProofBundle` wraps `disclosureProof` and produces
  the bundle a downstream envelope will carry.
- Tests covering: default-rules self-declaration matches
  today's shape; multi-rule self-declaration produces a
  disclosure proof that verifies via the existing
  `verifyDisclosureProof`; non-existent action returns null;
  duplicate action names are rejected at creation time.

About one session. Zero new cryptographic code anywhere.

### Phase B — Authorized envelope shape + verifier

UI-adjacent cut. Defines how a child envelope (membership
credential, expulsion record, charter amendment, etc.) carries
its authorization proof. Ships:

- New optional leaf on credential-kind attestations:
  `authorized_by` — a canonical-JSON-encoded
  `{org_identity: pubkey, action: string, proof:
  DisclosureProofBundle}`. The leaf sits inside the claim tree
  so the envelope's signature covers the authorization proof
  too (no detached-proof footgun).
- Helper `verifyOrgAuthorization(envelope, knownOrgs) →
  { authorized: boolean; reason: string }` that:
  1. Reads the `authorized_by` leaf
  2. Looks up the org's self-declaration in `knownOrgs`
  3. Runs `verifyDisclosureProof` on the carried bundle
  4. Confirms the reconstructed claim root matches the org
     self-declaration's
  5. Counts how many of the envelope's signers appear in the
     disclosed rule's `eligible` list
  6. Returns `authorized: true` iff count ≥ rule.threshold
- Tests: happy path, missing org, mismatched root, threshold
  not met, eligible-list mismatch, malformed proof bundle.

About one session.

### Phase C — UI for multi-rule org creation + per-action signing

UI cut. Extends the org-creation flow to let the operator
declare multiple rules at creation time, and extends the
org-action flows (membership issuance, future expulsion, etc.)
to pick the right rule and gather eligible signatures.

- Org-creation form in `SettingsScreen` (entry point confirmed
  at cut time via grounding pass) gains a "Governance rules"
  section that defaults to the single routine_issuance rule
  but lets the operator add more before signing the
  declaration.
- `OfficialsEditorModal` (or a sibling `RulesEditorModal`)
  lets the operator edit rules post-declaration; editing
  triggers a new self-declaration that must be authorized by
  the prior charter_amendment rule (or, if no
  charter_amendment rule exists, by the founder's direct sig
  — backward compatibility for the default-rules case).
- Existing `CosignRequestModal` gains a "for org action X"
  mode that pre-fills the recipient picker with the rule's
  eligible signers and shows the threshold inline.
- `RatificationsBadge` extended to read the action off the
  envelope and render `N of M (rule: routine_issuance)`
  instead of just the flat count.

About one to two sessions.

### Phase D — Charter amendment chain + dissolution

UI cut + a small chain-walker helper. The amendment story is
already implicit in Phase A (a new self-declaration is just
another envelope), but Phase D makes it explicit and adds the
dissolution endpoint.

- `walkCharterChain(holdings, orgIdentity) →
  Attestation[]` returns the chain of self-declarations from
  founding to most-recent, validating each transition.
- `findActiveCharter(holdings, orgIdentity) → Attestation |
  null` returns the latest validly-amended self-declaration.
- Dissolution is a special action whose rule, when satisfied,
  emits a `dissolution` meta-kind envelope that subsequent
  verifiers honor as "this org no longer issues credentials."
  Existing credentials remain valid (the dissolution is
  forward-looking, not retroactive).
- Tests for chain integrity: amendment without proper
  authorization is rejected; founder-direct-amend works only
  when no `charter_amendment` rule exists; circular chain is
  rejected; missing intermediate is flagged as truncated
  (similar to `MembershipChainSheet`'s truncation pattern).

About one to two sessions.

## What is NOT in this roadmap

- **Aggregate signatures (FROST / MuSig2) / signer
  anonymity.** Deferred to a future opt-in tier per the
  preserved FROST brief.
- **Bitcoin-script multisig / on-chain Taproot output
  spending.** The wallet doesn't spend Bitcoin UTXOs; this
  roadmap ports Taproot's SHAPE to off-chain attestations, not
  Bitcoin script execution.
- **Silent-objection admission with block-anchored deadlines.**
  Real primitive; depends on anchoring-worker plumbing not in
  scope. Can layer on top of the Tapscript-style substrate
  later without breaking change.
- **Cross-org federation governance.** Same as the prior
  briefs.
- **Voting beyond binary signature aggregation.** Charter
  thresholds remain integer counts; ranked-choice and
  weighted-stake voting are explicitly out.
- **In-place self-declaration mutation.** Amendments always
  publish a new self-declaration. No in-place rewrite.

## Prerequisites + risk surface

- **No new dependencies.** No new tapit-attest API. No new
  crypto. The headline win of this approach is that the
  cryptographic primitive (`disclosureProof` /
  `verifyDisclosureProof` / their multi-leaf variants) is
  already shipped, tested in production for selective
  disclosure, and reused verbatim for authorization proofs.
- **Verifier-rule correctness is the main risk** (same as
  list-of-sigs brief). The Phase B verifier is the
  load-bearing check; test discipline must include malformed
  proofs, mismatched roots, threshold underflow, eligible-set
  mismatches, duplicate-signer collapse, and the charter-chain
  walk's circular-reference detection.
- **Cross-envelope dependency.** Authorized envelopes
  reference the org's self-declaration by envelopeId. The
  verifier needs the self-declaration in its known-orgs
  store. This is the same precondition as today's membership
  verification (verifiers need the roster), so no new
  storage-layer work is required, but the UI should surface
  "I can't verify this — I don't hold the org's
  declaration" when the precondition fails.
- **Fuzz tests on the auth-tree merkleization.** The shipped
  `disclosureProof` machinery has been exercised in
  production for selective disclosure, but the
  ruleset-encoding pattern is new. Fuzz the rule-encoding
  roundtrip: arbitrary rule objects in, canonical-JSON
  encoded leaves out, disclosure-proof out, verify-back
  matches.

## Estimated calendar

| Phase | Sessions | Calendar |
| --- | --- | --- |
| A — Auth-rule type + selfDeclareOrganization extension | 1 | 1-2 days |
| B — Authorized envelope shape + verifier | 1 | 2-3 days |
| C — UI for multi-rule creation + per-action signing | 1-2 | 3-5 days |
| D — Charter amendment chain + dissolution | 1-2 | 3-5 days |
| **Total arc** | **4-6 sessions** | **~1.5-3 weeks** |

Similar calendar to the list-of-sigs brief because most of the
new work is wallet-side UI plumbing on a cryptographic primitive
that's already in production. Slightly larger range on Phase C/D
because the multi-rule UI and amendment-chain UX each have a
real design surface (how does the operator name rules, how is
the chain visualized, etc.) that warrants chip-form check-ins
during the cut.

## Approval gate

Operator approves this brief → I write the canonical
`decisions.md` entry recording the substrate choice
(Tapscript-style leaf tree over list-of-sigs and FROST) and the
four-phase shape, then cut Phase A's first sub-task (AuthRule
type + selfDeclareOrganization extension + proveAuthorization
helper + tests) in the next dispatch. The three prior briefs
stay in the briefs folder as historical context; the
list-of-sigs brief is preserved as the simpler fallback if
Tapscript-style proves heavier than expected during
implementation, the FROST brief is preserved as the upgrade
path for the day an org needs signer-anonymity.
