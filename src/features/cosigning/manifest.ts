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
    "Signing happens locally; only public envelopes cross the wire. Keys-never-leave preserved. Uses tapit-attest's envelopeId for matching, canonicalEnvelope for display-safe serialization, signEnvelope for the witness signature, verifyEnvelope for incoming-envelope validation, assertWellFormed for paste-input safety.",
};
