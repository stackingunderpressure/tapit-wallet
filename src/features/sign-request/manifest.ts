import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'sign-request',
  born: '2026-05-21',
  purpose:
    "Layer 2 — the inter-app signing pathway via deeplink. A third-party app or another wallet constructs a URL pointing at /sign with a base64-encoded SignRequest in the query string. The wallet decodes it, renders a plain-English approval screen (per DESIGN.md §9 — the screen IS the product) showing the requesting origin, the host of the callback URL the operator's about to redirect to, and the concrete content being signed. On approve, the wallet builds the attestation via the right tapit-attest builder, signs with the active key, holds it, queues anchoring, and redirects to the callback URL with a SignGrant query param. On decline, redirects with a structured SignDecline. The wallet is the one place keys live; this is how every other app gets a signature without ever holding a key.",
  touches: [
    'src/features/sign-request/types.ts',
    'src/features/sign-request/parseSignRequest.ts',
    'src/features/sign-request/renderRequest.tsx',
    'src/features/sign-request/approveRequest.ts',
    'src/features/sign-request/declineRequest.ts',
    'src/features/sign-request/SignApprovalScreen.tsx',
  ],
  depends_on: ['wallet-core', 'storage', 'anchoring'],
  pause_safe: false,
  removal_safe: false,
  monetizable: false,
  notes:
    "Phase 3 intent is 'attest' only — wallet creates a NEW signed envelope from the request's fields. Future intents (cosign-existing, disclosure-proof) come in later phases. Nostr NIP-46 transport stays explicitly OUT of v1 per DESIGN.md; that's a different transport layer that would replace the deeplink, sharing the same SignRequest/SignGrant message shapes. The shapes live in this feature for v1; hoisting them into tapit-attest is a future move if a fleet ever needs them shared across multiple wallets.",
};
