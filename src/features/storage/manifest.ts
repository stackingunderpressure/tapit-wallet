import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'storage',
  born: '2026-05-21',
  purpose:
    'Persistence layer for the encrypted wallet snapshot. Stores ciphertext in IndexedDB (offline-fast) and mirrors it to Supabase wallet_blobs (cross-device, recovery). The host only ever sees ciphertext; decryption happens client-side.',
  touches: [
    'src/features/storage/walletStore.ts',
    'src/features/storage/localStore.ts',
    'src/features/storage/remoteStore.ts',
    'src/features/storage/prefsStore.ts',
    'src/features/storage/mediaStore.ts',
    'src/features/storage/remoteMediaStore.ts',
    'src/features/storage/messagesStore.ts',
    'supabase/migrations/20260521000001_create_wallet_blobs.sql',
    'supabase/migrations/20260522000001_create_wallet_media_bucket.sql',
  ],
  depends_on: [],
  pause_safe: false,
  removal_safe: false,
  monetizable: false,
  notes:
    'Last-write-wins between local and remote, keyed by updated_at. Per DISCOVERY.md, the wallet_blobs table is scoped by RLS to the owner.',
};
