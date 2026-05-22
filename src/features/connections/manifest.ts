import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'connections',
  born: '2026-05-22',
  purpose:
    'Phase 5a of the Mycelium peer network (MYCELIUM_NETWORK_SPEC.md) — the in-person handshake. Two wallets physically together exchange identities by QR and co-sign one relationship-kind attestation carrying a verification=in-person leaf (Tier P). Both wallets hold the co-signed connection; the home People tab lists them. The co-signature is what makes the in-person tier honest — a record can carry both signatures only if both wallets took part. Local only; no networking — Nostr transport is a later Phase 5 increment.',
  touches: [
    'src/features/connections/HandshakeModal.tsx',
    'src/features/connections/createHandshake.ts',
    'src/features/connections/ConnectionCard.tsx',
  ],
  depends_on: ['wallet-core', 'qr', 'cosigning', 'anchoring'],
  pause_safe: true,
  removal_safe: false,
  monetizable: false,
  notes:
    'A handshake is a relationship-kind attestation — no new tapit-attest kind. HandshakeModal reuses QrShow / QrScanModal and the cosigning parseEnvelope + mergeSignatures helpers. The People tab in wallet-core/HomeScreen.tsx imports HandshakeModal and ConnectionCard, so removal_safe is false. Three QR transmissions per handshake: initiator identity, responder-signed handshake, co-signed handshake.',
};
