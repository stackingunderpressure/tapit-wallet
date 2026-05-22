import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'connections',
  born: '2026-05-22',
  purpose:
    'Phases 5a and 5b of the Mycelium peer network (MYCELIUM_NETWORK_SPEC.md). Phase 5a — the in-person handshake: two wallets physically together exchange identities by QR and co-sign one relationship-kind attestation carrying a verification=in-person leaf (Tier P); both hold it; the home People tab lists them. Phase 5b — organizations and membership: an organization is itself a wallet, and a membership is a credential-kind attestation the organization signs about a person; memberships nest (an organization joins a larger one the same way a person does) and list under the home Identity tab. Local only; no networking — Nostr transport is a later Phase 5 increment.',
  touches: [
    'src/features/connections/HandshakeModal.tsx',
    'src/features/connections/MembershipModal.tsx',
    'src/features/connections/createHandshake.ts',
    'src/features/connections/createMembership.ts',
    'src/features/connections/ConnectionCard.tsx',
    'src/features/connections/MembershipCard.tsx',
  ],
  depends_on: ['wallet-core', 'qr', 'cosigning', 'anchoring'],
  pause_safe: true,
  removal_safe: false,
  monetizable: false,
  notes:
    'A handshake is a relationship-kind attestation; a membership is a credential-kind attestation — no new tapit-attest kinds. The modals reuse QrShow / QrScanModal and the cosigning parseEnvelope + mergeSignatures helpers. wallet-core/HomeScreen.tsx imports both modals and both cards, so removal_safe is false. The handshake is co-signed (3 QR transmissions); a membership is one-directional (2 QR transmissions — only the issuing organization signs).',
};
