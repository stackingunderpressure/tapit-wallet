// Backup-health banner copy for the home screen. Pure-logic helper
// extracted from HomeScreen 2026-05-28 (PLAN.md Tier 1 item 6) so
// the local-newer-than-cloud branch could be tested in isolation
// and the priority order of banner cases stays auditable as new
// sync-state conditions land.
//
// Priority order (first match wins):
//   1. cloudSync off            — wallet lives only on this device
//   2. lastRemoteFailedSync set — the last remote push was REJECTED
//   3. lastRemoteSync null      — first sync has not happened yet
//   4. lastLocalSync > lastRemoteSync — local newer than cloud
//   5. lastRemoteSync age > STALE_AFTER_MS — cloud is more than a day old
//   6. otherwise null           — no banner
//
// Priority 4 (the 2026-05-28 PLAN.md Tier 1 item 6 addition) wins
// over priority 5 because the local-newer case is more specific and
// more actionable — telling the operator "your latest changes are
// not yet backed up" is more useful than the generic "cloud is
// more than a day old" when both are true.
//
// Priority 2 (the 2026-05-31 hardening) is the loudest case and sits
// directly under cloudSync-off. It fires whenever the most recent
// remote push was ATTEMPTED and threw, with no later success having
// cleared it — walletStore.save persists lastRemoteFailedSync on the
// catch branch and nulls it on success. Before this, a remote write
// that failed repeatedly only ever surfaced as the soft amber
// "local changes have not reached the cloud yet" message (which
// actively undersells a multi-day silent failure) and the day-late
// stale-cloud warning. This branch is tone 'error' so the home
// screen paints it red, and it carries action 'retry' so the
// operator can force a fresh push from the banner itself instead of
// waiting for an incidental save. It wins over local-newer and
// stale-cloud because an active rejection is both more urgent and
// more actionable than either symptom that follows from it.

export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export interface BackupBannerInput {
  cloudSync: boolean;
  lastRemoteSync: string | null;
  lastLocalSync: string | null;
  /**
   * ISO 8601 of the most recent remote push that was attempted and
   * THREW, or null when the most recent attempt succeeded (or none
   * has been attempted). Persisted in prefs so a backup failure
   * survives reload rather than evaporating with the ephemeral
   * SaveOutcome.remoteFailed flag. Added 2026-05-31.
   */
  lastRemoteFailedSync: string | null;
}

export interface BackupBanner {
  tone: 'ok' | 'warn' | 'error';
  text: string;
  /**
   * When 'retry', the surface renders a Retry control that re-runs a
   * full save (which re-attempts the remote push). Only the active
   * backup-failure case sets this today.
   */
  action?: 'retry';
}

export function backupBanner(
  prefs: BackupBannerInput,
  now: number = Date.now(),
): BackupBanner | null {
  if (!prefs.cloudSync) {
    return {
      tone: 'warn',
      text: 'Cloud backup is off. Your wallet lives only on this device.',
    };
  }
  if (prefs.lastRemoteFailedSync) {
    return {
      tone: 'error',
      action: 'retry',
      text: 'Cloud backup is failing. Your latest changes are safe on this device, but the cloud has not accepted a save. Tap Retry — if it keeps failing, check that you are still signed in.',
    };
  }
  if (!prefs.lastRemoteSync) {
    return {
      tone: 'warn',
      text: 'Cloud backup pending — first sync has not completed yet.',
    };
  }
  if (
    prefs.lastLocalSync &&
    prefs.lastLocalSync > prefs.lastRemoteSync
  ) {
    return {
      tone: 'warn',
      text: 'Local changes have not reached the cloud yet — they are safe on this device but not yet backed up. The next save will try again.',
    };
  }
  const age = now - new Date(prefs.lastRemoteSync).getTime();
  if (age > STALE_AFTER_MS) {
    return { tone: 'warn', text: 'Cloud backup is more than a day old.' };
  }
  return null;
}

// Sovereign build: there is no cloud copy, so the health line is about the
// backup file (SOVEREIGN_SYNC_PLAN.md section 4, decision 5: nudge after 30
// days). Never claims more than the wallet knows: a file downloaded before
// the date was recorded is reported as "date unknown", not as fresh.

export const FILE_STALE_AFTER_DAYS = 30;

export interface FileBackupInput {
  localBackupDownloaded: boolean;
  lastFileBackupAt: string | null;
}

export function fileBackupBanner(
  prefs: FileBackupInput,
  now: number = Date.now(),
): BackupBanner | null {
  if (!prefs.lastFileBackupAt) {
    if (prefs.localBackupDownloaded) {
      return {
        tone: 'warn',
        text: "This wallet doesn't know when your last backup file was made. Download a new one in Settings, Backup & recovery.",
      };
    }
    return {
      tone: 'warn',
      text: 'Your wallet is saved only on this device. Download a backup file in Settings, Backup & recovery, so you can get it back if this device is lost.',
    };
  }
  const days = Math.floor((now - new Date(prefs.lastFileBackupAt).getTime()) / 86_400_000);
  if (days >= FILE_STALE_AFTER_DAYS) {
    return {
      tone: 'warn',
      text: `Your last backup file is ${days} days old. Download a new one in Settings, Backup & recovery, so it holds your latest messages and changes.`,
    };
  }
  return null;
}

// The one-line backup status at the top of home in the sovereign build, next
// to the Save now button (replaces the file banner and the way-back-in nudge
// there). "Changes since" compares the last wallet save on this device with
// the last backup file, so it is about wallet changes (entries, contacts,
// vaults), not every message.

export interface BackupStatusInput extends FileBackupInput {
  lastLocalSync: string | null;
}

export interface BackupStatus {
  tone: 'ok' | 'warn';
  text: string;
}

function ago(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

export function backupStatusLine(prefs: BackupStatusInput, now: number = Date.now()): BackupStatus {
  if (!prefs.lastFileBackupAt) {
    return prefs.localBackupDownloaded
      ? { tone: 'warn', text: 'Last backup date unknown. Save a new one.' }
      : { tone: 'warn', text: 'Not backed up. If you lose this phone, the wallet is gone.' };
  }
  const at = new Date(prefs.lastFileBackupAt).getTime();
  const age = now - at;
  const changed = !!prefs.lastLocalSync && new Date(prefs.lastLocalSync).getTime() > at;
  const stale = age >= FILE_STALE_AFTER_DAYS * 86_400_000;
  const base = `Last backup ${ago(age)}`;
  if (changed) return { tone: 'warn', text: `${base} · changes since` };
  if (stale) return { tone: 'warn', text: `${base} · time for a new one` };
  return { tone: 'ok', text: `${base} · up to date` };
}
