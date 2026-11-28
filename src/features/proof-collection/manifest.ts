import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'proof-collection',
  born: '2026-11-28',
  purpose:
    'Letters you carry. Pick records someone else signed for you (connections, family, memberships, confirmed journal entries) and hand over a link; the other person opens it at /verify, with or without Tapit, and sees each letter checked on their own device: what it says, that every signature is genuine, and when it was dated in Bitcoin. No scores, no lookups, no network.',
  touches: [
    'src/features/proof-collection/**',
    'src/features/disclosure/VerifyProofScreen.tsx',
    'src/features/wallet-core/HomeScreen.tsx',
    'src/App.tsx',
  ],
  depends_on: ['disclosure', 'connections', 'qr', 'wallet-core'],
  pause_safe: true,
  removal_safe: false,
  monetizable: false,
  notes:
    "Operator, 2026-11-28, after rejecting a scored trust map: \"Only what I choose to show you. If it helps it helps if not sorry. Maybe you show me proof I see it and decide. That's the whole thing.\" Slice 1 of the 'letters you carry' mockup (claude.ai/artifact/EDxJtrGQKgUsFj2bP4MqL5). A letter = a held attestation with at least one valid signature from a key not in this wallet's keyHistory. The bundle (type 'tapit-proof-collection') carries the whole signed envelopes with their anchors, the holder's identity and key history, and the holder's own labels for signers -- shown to the reader as the holder's word, never as checked. The reader's checks: every signature genuine (verifyEnvelope), the Bitcoin date re-verified against the envelope digest (verifyProofAnchor), and whether the letter names the holder (subject or a signer is one of the holder's keys). Honest limits shown on screen: a letter proves who signed and when, not that it is true; an unknown signer is only a name; a link can be passed on like a paper reference. Not yet built (later slices): the reader's own 'do I know this signer' from their wallet, 'check privately with my people', 'anything more current?', asking someone for a letter, signer key-rotation display, and proof that the person showing the link is the holder.",
};
