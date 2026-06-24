import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'sign-request',
  born: '2026-05-21',
  purpose:
    "Layer 2 — the inter-app signing pathway via deeplink. A third-party app or another wallet constructs a URL pointing at /sign with a base64-encoded SignRequest in the query string. The wallet decodes it, renders a plain-English approval screen (per DESIGN.md §9 — the screen IS the product) showing the requesting origin, the host of the callback URL the operator's about to redirect to, and the concrete content being signed. On approve, the wallet builds the attestation via the right tapit-attest builder, signs with the active key, holds it, queues anchoring, and redirects to the callback URL with a SignGrant query param. On decline, redirects with a structured SignDecline. The wallet is the one place keys live; this is how every other app gets a signature without ever holding a key.",
  touches: [
    'src/features/sign-request/types.ts',
    'src/features/sign-request/parseSignRequest.ts',
    'src/features/sign-request/parseSignRequest.test.ts',
    'src/features/sign-request/renderRequest.tsx',
    'src/features/sign-request/approveRequest.ts',
    'src/features/sign-request/coSignEnvelope.ts',
    'src/features/sign-request/coSignEnvelope.test.ts',
    'src/features/sign-request/declineRequest.ts',
    'src/features/sign-request/SignApprovalScreen.tsx',
  ],
  depends_on: ['wallet-core', 'storage', 'anchoring', 'cosigning'],
  pause_safe: false,
  removal_safe: false,
  monetizable: false,
  notes:
    "SignRequest is now a discriminated union on `intent`. 'attest' (original) — wallet creates a NEW signed envelope from kind/tier/subject/fields. 'cosign-existing' (added 2026-06-12, the Trailhead mutual-proof-of-presence atom) — the requester hands over an already-signed envelope and the wallet ADDS its signature, returning the merged multi-signature envelope; the claim is untouched so the canonical envelopeId is identical before and after. parseSignRequest validates the incoming envelope with parseEnvelope + verifyEnvelope and declines `invalid_envelope` if it doesn't parse or carries no valid signature (never co-sign garbage). The sign+merge logic is the pure coSignEnvelope() helper (wallet.sign then mergeSignatures dedupe+verify) so it's unit-tested directly; approveRequest branches on intent and reuses it. renderRequest shows a co-sign view (what it is + how many already signed) for the cosign branch; the approval button reads 'co-sign this'. depends_on gained cosigning (mergeSignatures). Still deeplink-only; Nostr NIP-46 transport stays OUT of v1 (a different transport sharing the same message shapes). 'sign-in' (added 2026-06-24, the DynastyTrust login atom) — the requester mints a TA-1 SignInChallenge, persists it, and hands it over; the wallet answers with wallet.signIn() (active key, private key never leaves) and returns a SignInGrant carrying the SignInAttestation. NOTHING is held, anchored, or saved — a sign-in is an ephemeral bearer-challenge proof, not a kept attestation — so approveSignRequest returns early before the hold/anchor path. The requester verifies with verifySignIn against its own stored challenge (echo + freshness + signature). This supersedes the earlier 'use a meta attestation for SSO' note: the dedicated challenge primitive is lighter and doesn't pollute holdings. The shapes live in this feature for v1; hoist into tapit-attest when a fleet needs them shared. Remaining deferred intent: disclosure-proof.",
};
