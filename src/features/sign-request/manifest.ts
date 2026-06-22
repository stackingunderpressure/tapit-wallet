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
    'src/features/sign-request/signIn.test.ts',
    'tapit-attest/src/core/sign-in.ts',
  ],
  depends_on: ['wallet-core', 'storage', 'anchoring', 'cosigning'],
  pause_safe: false,
  removal_safe: false,
  monetizable: false,
  notes:
    "SignRequest is now a discriminated union on `intent`. 'attest' (original) — wallet creates a NEW signed envelope from kind/tier/subject/fields. 'cosign-existing' (added 2026-06-12, the Trailhead mutual-proof-of-presence atom) — the requester hands over an already-signed envelope and the wallet ADDS its signature, returning the merged multi-signature envelope; the claim is untouched so the canonical envelopeId is identical before and after. parseSignRequest validates the incoming envelope with parseEnvelope + verifyEnvelope and declines `invalid_envelope` if it doesn't parse or carries no valid signature (never co-sign garbage). The sign+merge logic is the pure coSignEnvelope() helper (wallet.sign then mergeSignatures dedupe+verify) so it's unit-tested directly; approveRequest branches on intent and reuses it. renderRequest shows a co-sign view (what it is + how many already signed) for the cosign branch; the approval button reads 'co-sign this'. depends_on gained cosigning (mergeSignatures). Still deeplink-only; Nostr NIP-46 transport stays OUT of v1 (a different transport sharing the same message shapes). SSO needs NO new intent — an app gets a wallet-signed session assertion today by requesting a `meta` attestation (nonce + issued_at + expires_at) via 'attest' and verifying the returned envelope against the user's pubkey. The shapes live in this feature for v1; hoist into tapit-attest when a fleet needs them shared. Remaining deferred intent: disclosure-proof. 'sign-in' (added 2026-06-22, sign-in by attestation cross-repo with DynastyTrust as verifier) — the requester (a relying party) mints a single-use SignInChallenge, persists it, and embeds it in the request; the wallet answers by signing the challenge and returns a SignInAttestation in the grant's `signIn` field (NOT `envelope` — a SignInAttestation is not an Attestation envelope; SignGrant.envelope is now optional and absent for sign-in grants). NOTHING is created/held/anchored and NO funds move — it is a one-time login proof carrying only the public key, the echoed challenge, and a Schnorr signature. The private key never leaves the Wallet: approveRequest computes the digest via tapit-attest's signInDigestFor(base) and signs through wallet.signDigest(digest); it deliberately does NOT call answerSignInChallenge() because that takes a raw private-key hex and would force extracting the key. signInDigestFor was added to tapit-attest/src/core/sign-in.ts as a thin pass-through to the existing internal signInDigest — the digest and base shape are unchanged so cross-repo verify parity (DynastyTrust's golden fixture) holds; signIn.test.ts proves the wallet path and answerSignInChallenge both verify against the same challenge, which is only possible if the exposed helper bytes equal the internal digest bytes. parseSignRequest validates the challenge shape (v===1, 32-byte hex nonce, non-empty audience, string timestamps) and declines invalid_request on a malformed challenge before the user is asked.",
};
