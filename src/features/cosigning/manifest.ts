import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'cosigning',
  born: '2026-05-21',
  purpose:
    "Multi-party signing primitives. Operator A requests a witness signature on one of their entries — wallet renders the attestation envelope as JSON the operator hands off to operator B (text, AirDrop, Signal, whatever channel they use). Operator B pastes the envelope, sees a plain-English preview, signs, returns the signed envelope. Operator A absorbs the return — the wallet merges signatures by envelopeId on the existing held attestation and re-saves. Same primitive supports custody-handoff for the grandchild scenario (a meta-kind attestation signed by old + new custodian). QR-as-transport is a later UX polish on top of these flows.",
  touches: [
    'src/features/cosigning/CosignRequestModal.tsx',
    'src/features/cosigning/CosignAsWitnessModal.tsx',
    'src/features/cosigning/AbsorbCosignModal.tsx',
    'src/features/cosigning/VouchWitnessModal.tsx',
    'src/features/cosigning/CustodyHandoffModal.tsx',
    'src/features/cosigning/mergeSignatures.ts',
    'src/features/cosigning/parseEnvelope.ts',
    'src/features/cosigning/EnvelopePreview.tsx',
    'src/features/cosigning/createCustodyHandoff.ts',
  ],
  depends_on: ['wallet-core', 'storage', 'journal', 'connections', 'governance'],
  pause_safe: false,
  removal_safe: false,
  monetizable: false,
  notes:
    "Signing happens locally; only public envelopes cross the wire. Keys-never-leave preserved. Uses tapit-attest's envelopeId for matching, canonicalEnvelope for display-safe serialization, signEnvelope for the witness signature, verifyEnvelope for incoming-envelope validation, assertWellFormed for paste-input safety. Governance direction: Phase 8 Phase C cut 3 added an optional orgContext mode to CosignRequestModal — when the operator is requesting co-signs for an org-issued credential under a specific Tapscript-style authorization rule, the modal reads the rule via findAuthRule from src/features/governance/authRule.ts, shows a banner naming the action and required threshold, and replaces the general PeerPicker with an eligible-signers picker scoped to the rule's eligible set so the operator can only fan out to signers whose signatures will count toward the threshold. Phase 8 Phase E4 cut 4 widened orgContext into a discriminated union so the same modal also handles joiner-side vouch collection: the new `kind: 'org_vouch'` variant carries the org name and the required vouch threshold (from a requires_vouch JoinPolicy), renders a vouch-framed banner instead of the org-action banner, and falls back to the general PeerPicker because the joiner does not know which of their peers are members — the eligible set is open-ended and the org's receive-side gate confirms vouch eligibility at acceptance time. A useEffect now resets sent/sendStatus/sendError whenever the recipient changes so the joiner can fan their signed self-membership envelope out to multiple peers in one modal lifecycle (also self-corrects misclicks on the org_action constrained list). JoinOrgModal opens this variant from the send step of a requires_vouch join flow via the same lazy-loaded chunk MembershipModal and PromoteRouter already share. Phase 8 Phase E4 cut 5 (peer-side vouch loop close, 2026-05-27) added VouchWitnessModal as the other half of the requires_vouch flow: the joiner's CosignRequestModal in org_vouch mode fans the joiner's 1-sig self-membership envelope out to N peers via the Mycelium transport; each of those peers' wallets routes the arrival to vouch-witness (the new InboxRouteAction added to envelopeRoute.ts) and surfaces VouchWitnessModal pre-loaded with the envelope. The modal frames the decision as personal trust — 'X is asking you to vouch for their join request to Y; vouching means attaching your signature as a personal warrant' — rather than as co-authorship, which is CosignAsWitnessModal's framing for handshake co-signs. The signing mechanic is identical at the substrate (wallet.sign on the existing envelope, append a signature, send the result back through encryptedInbox) but the surface lives separate because the operator question is different. Destination on send-back is the joiner (envelope subject from readSelfMembership), not necessarily incomingSender — a hypothetical relay-peer who forwarded the envelope is not the absorb-target; the joiner is the one whose AbsorbCosignModal merges the vouch into their held copy and ticks the joiner-side progress chip up by one. Lazy-loaded from HomeScreen via the standard React.lazy + Suspense pattern the other inbox-routed modals already use.",
};
