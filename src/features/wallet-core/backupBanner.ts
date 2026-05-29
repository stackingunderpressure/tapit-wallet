// Backup-health banner copy for the home screen. Pure-logic helper
// extracted from HomeScreen 2026-05-28 (PLAN.md Tier 1 item 6) so
// the local-newer-than-cloud branch could be tested in isolation
// and the priority order of banner cases stays auditable as new
// sync-state conditions land.
//
// Priority order (first match wins):
//   1. cloudSync off            — wallet lives only on this device
//   2. lastRemoteSync null      — first sync has not happened yet
//   3. lastLocalSync > lastRemoteSync — local newer than cloud
//   4. lastRemoteSync age > STALE_AFTER_MS — cloud is more than a day old
//   5. otherwise null           — no banner
//
// Priority 3 (the 2026-05-28 PLAN.md Tier 1 item 6 addition) wins
// over priority 4 because the local-newer case is more specific and
// more actionable — telling the operator "your latest changes are
// not yet backed up" is more useful than the generic "cloud is
// more than a day old" when both are true.

export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export interface BackupBannerInput {
  cloudSync: boolean;
  lastRemoteSync: string | null;
  lastLocalSync: string | null;
}

export interface BackupBanner {
  tone: 'ok' | 'warn';
  text: string;
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
