import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'disclosure',
  born: '2026-05-21',
  purpose:
    'Selective leaf disclosure (DESIGN.md §8). The "prove I am over 21 without revealing my birthday" demonstration. From a held attestation, the operator picks a single leaf of the claim and the wallet produces a tapit-attest DisclosureProofBundle that the operator hands off to a verifier. The verifier opens the wallet PWA at /verify (no auth required — they may not have a wallet), pastes the proof, and the wallet runs verifyDisclosureProof against the recomputed claim root + canonical envelope digest. The verifier sees what was signed, who signed it, and whether the math checks out.',
  touches: [
    'src/features/disclosure/ShareProofModal.tsx',
    'src/features/disclosure/VerifyProofScreen.tsx',
    'src/features/disclosure/parseDisclosureProof.ts',
    'src/features/disclosure/leafIndex.ts',
  ],
  depends_on: ['wallet-core'],
  pause_safe: false,
  removal_safe: false,
  monetizable: false,
  notes:
    "The /verify route lives outside AuthGate because the verifier is a third-party context — anyone with a copy of the PWA. The verifier never sees the operator's wallet, only the proof bundle they pasted, and the math is the truth.",
};
