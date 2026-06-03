import { useEffect, useRef } from 'react';
import type { Prefs } from '../storage/prefsStore.ts';
import type { SaveOutcome } from '../storage/walletStore.ts';
import { STALE_AFTER_MS } from './backupBanner.ts';

// Auto-backup-on-unlock. The cloud-backup banner is driven entirely by
// prefs timestamps, and the only thing that advances them is a save() —
// which previously fired ONLY when the operator changed holdings or
// toggled cloud-sync. An operator who just opens the wallet, reads, and
// closes it never triggers a save, so a backup that goes stale (or a
// first sync that never completed, or a sticky remote-failure flag)
// stays stuck showing the banner forever even though a single fresh push
// would clear it. The operator hit exactly this: the live banner read
// "Cloud backup is more than a day old" and never cleared because no new
// entry was being signed between opens.
//
// This hook closes the gap: once per unlock, if cloud-sync is ON and the
// cloud copy is either never-synced, actively-failing, or older than the
// staleness threshold, it fires one quiet save() to re-encrypt and
// re-push the snapshot. save() reloads prefs, so a success refreshes
// lastRemoteSync and the banner clears on its own with no operator tap.
// Failures are swallowed — the existing backup banner (with the
// Retry-feedback fix) still surfaces a genuine ongoing failure.
//
// The ref guard makes it fire at most once per unlock: it resets to
// false whenever the wallet is not unlocked, so a lock→unlock cycle
// re-arms it, but a re-render while already unlocked does not re-fire.
// `unlocked` is passed as a plain boolean (not the phase) so the effect
// deps stay primitive and the hook has no knowledge of the phase union.
export function isBackupStale(prefs: Prefs, now: number = Date.now()): boolean {
  if (!prefs.cloudSync) return false;
  if (!prefs.lastRemoteSync) return true;
  if (prefs.lastRemoteFailedSync !== null) return true;
  return now - new Date(prefs.lastRemoteSync).getTime() > STALE_AFTER_MS;
}

export function useAutoBackup(
  unlocked: boolean,
  prefs: Prefs,
  save: () => Promise<SaveOutcome>,
): void {
  const ranRef = useRef(false);
  useEffect(() => {
    if (!unlocked) {
      ranRef.current = false;
      return;
    }
    if (ranRef.current) return;
    if (!isBackupStale(prefs)) return;
    ranRef.current = true;
    void save().catch(() => {
      // A genuine ongoing failure stays surfaced by the backup banner;
      // this best-effort push does not need to handle it here.
    });
  }, [
    unlocked,
    prefs.cloudSync,
    prefs.lastRemoteSync,
    prefs.lastRemoteFailedSync,
    prefs,
    save,
  ]);
}
