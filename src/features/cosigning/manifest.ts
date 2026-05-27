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
    "Signing happens locally; only public envelopes cross the wire. Keys-never-leave preserved. Uses tapit-attest's envelopeId for matching, canonicalEnvelope for display-safe serialization, signEnvelope for the witness signature, verifyEnvelope for incoming-envelope validation, assertWellFormed for paste-input safety. Governance direction: Phase 8 Phase C cut 3 added an optional orgContext mode to CosignRequestModal — when the operator is requesting co-signs for an org-issued credential under a specific Tapscript-style authorization rule, the modal reads the rule via findAuthRule from src/features/governance/authRule.ts, shows a banner naming the action and required threshold, and replaces the general PeerPicker with an eligible-signers picker scoped to the rule's eligible set so the operator can only fan out to signers whose signatures will count toward the threshold. Phase 8 Phase E4 cut 4 widened orgContext into a discriminated union so the same modal also handles joiner-side vouch collection: the new `kind: 'org_vouch'` variant carries the org name and the required vouch threshold (from a requires_vouch JoinPolicy), renders a vouch-framed banner instead of the org-action banner, and falls back to the general PeerPicker because the joiner does not know which of their peers are members — the eligible set is open-ended and the org's receive-side gate confirms vouch eligibility at acceptance time. A useEffect now resets sent/sendStatus/sendError whenever the recipient changes so the joiner can fan their signed self-membership envelope out to multiple peers in one modal lifecycle (also self-corrects misclicks on the org_action constrained list). JoinOrgModal opens this variant from the send step of a requires_vouch join flow via the same lazy-loaded chunk MembershipModal and PromoteRouter already share.",
};
