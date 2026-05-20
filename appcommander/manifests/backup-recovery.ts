import type { FeatureManifest } from './_shared';

export const manifest: FeatureManifest = {
  slug: 'backup-recovery',
  born: '2026-05-18',
  purpose:
    "Keeps a wallet survivable. Client-side-encrypted backup (the wallet snapshot is encrypted before it ever reaches a host — the host stores ciphertext it cannot read) and peer-rebuild recovery (a lost wallet asks peers for its attestations and reassembles trustlessly, because every returned attestation self-verifies).",
  touches: [
    'src/features/backup-recovery/**',
    'supabase (wallet_blobs table — stores the EncryptedBlob only)',
    "tapit-attest — exportEncrypted / restore, and recoveryRequest / answerRecovery / recoverHoldings on the Wallet object",
  ],
  depends_on: ['auth', 'wallet-core'],
  pause_safe: true,
  removal_safe: false,
  monetizable: true,
  notes:
    "monetizable — cloud-synced encrypted backup is a natural paid tier; local-only backup stays free. removal_safe: false because losing this feature means a lost device is a lost identity. The host NEVER sees plaintext — if a code path here would store a decrypted snapshot, it is a bug.",
};
