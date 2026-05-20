import type { FeatureManifest } from './_shared';

export const manifest: FeatureManifest = {
  slug: 'wallet-core',
  born: '2026-05-18',
  purpose:
    "The heart of the app. Generates and holds the user's keypair, owns their stable identity, coordinates key rotation through a succession chain, and is the Merkle holder of their signed attestations. Wraps the Wallet object from tapit-attest in the app's screens — identity view, holdings view, create-wallet flow.",
  touches: [
    'src/features/wallet-core/**',
    "tapit-attest — the Wallet class (Layer 1, already built); inherited from the chassis, consumed as a file: dependency",
    'on-device storage of the wallet snapshot (the sovereign copy)',
  ],
  depends_on: ['auth'],
  pause_safe: false,
  removal_safe: false,
  monetizable: false,
  notes:
    "Load-bearing — wallet-core IS the product. The private key lives only here, only on the device, encrypted at rest; it is never logged, committed, or sent to a host in plaintext. Do NOT re-implement the Wallet object — inherit it from tapit-attest.",
};
