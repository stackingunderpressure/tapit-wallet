import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'disclosure',
  born: '2026-05-21',
  purpose:
    'Selective leaf disclosure (DESIGN.md §8). The "prove I am over 21 without revealing my birthday" demonstration. From a held attestation, the operator picks one or more leaves of the claim and the wallet produces a tapit-attest MultiDisclosureProofBundle — a pruned Merkle tree carrying just the disclosed leaves with non-disclosed siblings replaced by their hashes. The operator hands it to a verifier; the verifier opens the wallet PWA at /verify (no auth required — they may not have a wallet), pastes the proof, and the wallet runs verifyMultiDisclosureProof against the recomputed claim root + canonical envelope digest. Single-leaf and multi-leaf go through the same primitive. The verifier route also still accepts legacy single-leaf DisclosureProofBundle (parseDisclosureProof discriminates by structure) so proofs minted by older wallets still verify.',
  touches: [
    'src/features/disclosure/ShareProofModal.tsx',
    'src/features/disclosure/VerifyProofScreen.tsx',
    'src/features/disclosure/HowVerificationWorks.tsx',
    'src/features/disclosure/parseDisclosureProof.ts',
    'src/features/disclosure/leafIndex.ts',
    'src/features/disclosure/ShareCard.tsx',
    'src/features/disclosure/QuickShareModal.tsx',
    'src/features/disclosure/quickSharePresets.ts',
  ],
  depends_on: ['wallet-core', 'connections'],
  pause_safe: false,
  removal_safe: false,
  monetizable: false,
  notes:
    "The /verify route lives outside AuthGate because the verifier is a third-party context — anyone with a copy of the PWA. The verifier never sees the operator's wallet, only the proof bundle they pasted, and the math is the truth. ShareProofModal uses checkboxes (multi-select) and calls multiDisclosureProof for both one-field and many-field cases; the bundle shape is one pruned tree, not N stacked single-leaf bundles, so the wire payload stays small as the selection grows. Cut 7 (2026-05-24) added the Fresh share-card surface: ShareCard renders a 9:16 screenshot-targeted card carrying the assertion, the Bitcoin block stamp, and a verifier URL; QuickShareModal mints the proof and base64url-encodes it into a /verify?p=<bundle> URL when the encoded size fits under 1.8KB so the verifier taps once and the math runs automatically. The brief listed four Quick-share presets but only two are buildable today (verified-profile + organization-membership); the over-18 / over-21 presets need a birthday leaf added to the founding identity attestation, which is a structural identity-model change deferred to a future cut.",
};
