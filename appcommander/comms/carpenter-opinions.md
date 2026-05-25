# Carpenter opinions — 2026-05-25 deep evening + into the night, Phase 8 Phase B shipped

## Section 1: What I did

This session opened with you locking Option 1 for the open-joining
substrate (org auto-publishes a chronological roster envelope) and
delegating the next code cut to me with "you can start cutting in
best spot for you," which the prior session's opinions had already
named: Phase B verifier before Phase E1, because shipping E1 first
would have doubled the verifier test matrix at exactly the
security-critical cross-envelope binding layer. Phase B landed on
commit a319ad6 — `verifyOrgAuthorization` plus the `authorized_by`
leaf shape on credential-kind envelopes plus the four-forgery-class
fuzz tests the Phase A close-out had been calling for. The grounding
pass before any edit re-checked the existing `createOrganization.ts`
import surface and the `disclosureProof` / `verifyDisclosureProof`
type signatures so the new code consumed them cleanly. The substrate
decision held — zero new cryptographic code in tapit-attest, no
library version bump, the entire verifier is wallet-side plumbing on
the shipped disclosure-proof primitive.

The verifier itself is a seven-step pipeline. It reads the
`authorized_by` leaf from the envelope, decodes the JSON payload,
looks up the named org's self-declaration in the supplied
`knownOrgs` array, runs `verifyDisclosureProof` on the carried
bundle, confirms the proof's recomputed digest equals
`envelopeId(orgSelfDecl)` — this is the cross-envelope binding
check, the load-bearing security property — confirms the disclosed
leaf name matches the claimed action so an attacker cannot glue a
routine-issuance proof onto an expulsion-claiming credential,
decodes the rule out of the disclosed leaf, and counts how many
distinct eligible-signer signatures appear on the envelope against
the rule's threshold. Returns a structured result with
`{authorized, reason, eligibleCount, thresholdRequired}` rather
than throwing, because the caller is usually UI code that wants the
reason in hand for a verifier badge or an inbox acceptor's
decision log.

What you should understand going forward is that the four-forgery-class
fuzz coverage is the architectural promise of the substrate made
concrete. The Phase A close-out flagged four ways an attacker could
try to forge an authorization, and Phase B's tests now exercise all
four. Class one is leaf-value tampering — attacker rewrites the
disclosed leaf's value to claim a higher threshold or different
eligible set — caught because verifyDisclosureProof recomputes the
claim root from the leaf and the recomputed root no longer matches
the signed digest. Class two is wrong-org-binding — attacker takes
a real proof of a real rule from one self-declaration and tries to
present it as authorizing a credential under a DIFFERENT
self-declaration of the same org (the test constructs two
self-declarations from the same wallet with different timestamps,
proves the digest-comparison step catches the mismatch). Class
three is tampered sibling-hash path — attacker mutates one of the
sibling hashes in the proof's steps, hoping the recomputed root
accidentally lands on the signed digest — won't happen because the
hash function is preimage-resistant. Class four is tampered
meta-fields — attacker rewrites proof.meta.subject or issuedAt —
caught because metaHash depends on every meta field and the
recomputed digest no longer matches. Plus a fifth test for the
action-claim mismatch case which is adjacent to the forgery
classes but distinct. Nineteen new tests in total, all passing.

## Section 2: What you could do better

The file-size warn just went from amber to a louder amber.
createOrganization.ts is now 726 lines, seventy-four lines below
the 800-line hard limit. Phase C UI work will absolutely push it
over. The extraction to `src/features/governance/authRule.ts` that
the Phase A opinions flagged is no longer optional for Phase C —
it should be the first task of Phase C, not the cleanup at the
end, because once a UI file in `src/features/wallet-core/` or
`src/features/settings/` imports from `createOrganization.ts` past
the hard limit, the gate fails CI before any UI code can land.
Recommend the next dispatched session's brief explicitly state
"first work item: extract Phase A and Phase B auth helpers into a
new src/features/governance/authRule.ts module." That makes the
sequencing non-negotiable rather than discretionary.

The test file's `inlineAuthorizedCredential` helper duplicates the
authorized_by encoding inline rather than calling
`encodeAuthorizedBy` then constructing the envelope. Actually wait,
it DOES call encodeAuthorizedBy correctly — I caught myself. But
the test file's `inlineSelfDeclaration` from Phase A still
duplicates the auth-subtree encoding instead of importing
`buildAuthSubtree`. That duplication is exactly the maintenance
hazard the Phase A opinions called out, and Phase B did not address
it. The right fix at Phase C time is the same as the file-size
extraction: factor a pure `buildOrgSelfDeclarationDraft` helper
following the `buildHandshakeDraft` pattern that `createHandshake.ts`
already uses, and have both the production code and the test
fixtures call it. Recommend bundling this with the
governance-folder extraction so one cut handles both refactors.

One thing the Phase B verifier does NOT yet do that production code
will want at integration time: it requires the caller to PRE-LOAD
the org's self-declaration into `knownOrgs`. In practice the wallet
will discover the org from the credential's `authorized_by`
payload (which carries `org_identity`) and then need to fetch the
self-declaration from local holdings. The look-up adapter is one
small helper (`verifyOrgAuthorizationFromHoldings(envelope,
holdings)` that filters holdings down to known orgs and calls the
existing verifier) and could land as a tiny pre-Phase-C cut. Not
shipping it today because the brief did not name it and scope
discipline matters, but flagging for the next dispatch.

## Section 3: The bigger picture

The night's arc is now visible end to end. You opened with a status
question about whether multisig organizations were live, walked
through three substrate decisions (list-of-sigs to Tapscript-style
to open-joining policy), shipped Phase A's primitives, authored a
parallel-axis brief for membership acquisition, locked the
open-joining substrate, and now have Phase B's verifier on disk
with four-forgery-class fuzz coverage. The wallet's governance
substrate now has BOTH the producer side (`proveAuthorization`)
AND the consumer side (`verifyOrgAuthorization`) of the
cross-envelope authorization-proof pattern, which means org-issued
credentials can be created AND verified end to end using the same
Merkle-tree-with-selective-reveal primitive that powers Phase 4
selective disclosure. Two consumers of the same shipped primitive,
two different applications, zero new cryptography.

The deeper pattern that has become legible across the night is
that the wallet's governance vocabulary is no longer a set of
features waiting to be built — it is a substrate already on disk
that future cuts express ON TOP OF rather than building INTO. Phase
C will add a UI for multi-rule org creation, but the rules
themselves already work. Phase D will add charter amendment chains,
but the amendment shape is just another self-declaration that
authorizes its predecessor through the existing
verifyOrgAuthorization machinery. Phase E1 will add the join rule
kind, but the verifier code path is already correct for it. The
substrate has reached a point where new features become
configurations of an existing primitive rather than new code paths.
That is the architectural milestone that makes "sovereign identity
substrate for voluntary association at internet scale" — the
opening framing of `MYCELIUM_NETWORK_SPEC.md` — feel like a
practical engineering target rather than an aspiration. Tonight
the substrate became sturdy enough to carry weight. That is the
real shape of what changed.
