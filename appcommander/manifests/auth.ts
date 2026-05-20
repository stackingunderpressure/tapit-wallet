import type { FeatureManifest } from './_shared';

export const manifest: FeatureManifest = {
  slug: 'auth',
  born: '2026-05-18',
  purpose:
    "Login, session, and account primitives for the Tapit Wallet app. Email + password v1; magic-link / OAuth come later. This is the app *account* — distinct from the wallet identity, which is a keypair the user generates and holds (see wallet-core).",
  touches: [
    'src/features/auth/**',
    'supabase (auth.users + profiles tables)',
  ],
  depends_on: [],
  pause_safe: false,
  removal_safe: false,
  monetizable: false,
  notes:
    'Load-bearing — every other feature depends on a logged-in user_id, and RLS scopes wallet_blobs / connection_requests to it. The account is NOT the identity: a private key never touches the auth layer.',
};
