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
    'Last-write-wins between local and remote, keyed by updated_at. Per DISCOVERY.md, the wallet_blobs table is scoped by RLS to the owner. Prefs gained a `lastLocalSync` ISO timestamp field 2026-05-28 (PLAN.md Tier 1 item 6) that always advances when walletStore.save completes locally, regardless of remote outcome — the home-screen backupBanner uses lastLocalSync > lastRemoteSync as the honest signal for "local changes have not reached the cloud yet" so the operator can see the unsynced state rather than have it lurk silently. Migration-safe: prefsStore.load merges defaults under saved prefs so pre-2026-05-28 wallets without the field inherit null and the new banner branch stays inactive until the next save advances it. Hardening 2026-05-31: prefs also gained `lastRemoteFailedSync` — walletStore.save sets it on the remote-catch branch and clears it to null on a successful remote write, so a persistent (e.g. multi-day) Supabase rejection becomes a sticky flag that survives reload instead of lurking behind only the soft local-newer note plus the day-late staleness banner. The home-screen backupBanner reads it as the highest-priority warn case under cloudSync-off and paints a red Retry banner whose button re-runs a full save to re-attempt the push.',
};
