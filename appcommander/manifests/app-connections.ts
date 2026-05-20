import type { FeatureManifest } from './_shared';

export const manifest: FeatureManifest = {
  slug: 'app-connections',
  born: '2026-05-18',
  purpose:
    "Layer 2 — the inter-app connection pathway. Another app sends the wallet a SignRequest or HoldRequest; the user sees a legible approval screen (who is asking, what claim, what it commits them to); the user approves; the wallet signs and returns the result. This is how every other app reaches the user's keys without ever holding them.",
  touches: [
    'src/features/app-connections/**',
    'supabase (connection_requests table)',
    "tapit-attest — the SignRequest / SignGrant / HoldRequest message shapes (defined once in the shared library, inherited by every app)",
    'the Nostr NIP-46 Layer 2 transport (decision D-06)',
  ],
  depends_on: ['auth', 'wallet-core'],
  pause_safe: true,
  removal_safe: false,
  monetizable: false,
  notes:
    "The approval screen IS the product moment — a signature the user did not understand is not consent; do not treat it as plumbing. pause_safe: true means the wallet still works standalone if connections are disabled, but removal breaks the app↔wallet contract other apps depend on. Phase 3 in PLAN.md.",
};
