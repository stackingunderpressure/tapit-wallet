import { describe, expect, test } from 'vitest';
import {
  STALE_AFTER_MS,
  backupBanner,
  type BackupBannerInput,
} from './backupBanner.ts';

const T0 = '2026-05-28T12:00:00.000Z';
const T0_MS = new Date(T0).getTime();

function prefs(partial: Partial<BackupBannerInput> = {}): BackupBannerInput {
  return {
    cloudSync: true,
    lastRemoteSync: T0,
    lastLocalSync: T0,
    lastRemoteFailedSync: null,
    ...partial,
  };
}

describe('backupBanner', () => {
  test('cloudSync off wins over everything', () => {
    const banner = backupBanner(
      prefs({ cloudSync: false, lastRemoteFailedSync: T0 }),
    );
    expect(banner?.text).toMatch(/Cloud backup is off/);
  });

  test('remote-failure fires as a red retry banner when lastRemoteFailedSync is set', () => {
    const banner = backupBanner(prefs({ lastRemoteFailedSync: T0 }));
    expect(banner?.tone).toBe('error');
    expect(banner?.action).toBe('retry');
    expect(banner?.text).toMatch(/Cloud backup is failing/);
  });

  test('remote-failure wins over local-newer-than-cloud', () => {
    const banner = backupBanner(
      prefs({
        lastRemoteFailedSync: T0,
        lastRemoteSync: '2026-05-26T12:00:00.000Z',
        lastLocalSync: '2026-05-28T11:59:00.000Z',
      }),
    );
    expect(banner?.tone).toBe('error');
  });

  test('remote-failure wins over stale-cloud', () => {
    const old = new Date(T0_MS - STALE_AFTER_MS - 1000).toISOString();
    const banner = backupBanner(
      prefs({ lastRemoteFailedSync: T0, lastRemoteSync: old, lastLocalSync: old }),
      T0_MS,
    );
    expect(banner?.tone).toBe('error');
  });

  test('no banner once a later success clears lastRemoteFailedSync to null', () => {
    expect(backupBanner(prefs({ lastRemoteFailedSync: null }), T0_MS)).toBeNull();
  });

  test('first-sync-pending fires when cloudSync on and lastRemoteSync null', () => {
    const banner = backupBanner(prefs({ lastRemoteSync: null }));
    expect(banner?.text).toMatch(/Cloud backup pending/);
  });

  test('local-newer-than-cloud fires when lastLocalSync strictly later than lastRemoteSync', () => {
    const banner = backupBanner(
      prefs({
        lastRemoteSync: '2026-05-28T12:00:00.000Z',
        lastLocalSync: '2026-05-28T12:00:01.000Z',
      }),
    );
    expect(banner?.text).toMatch(/Local changes have not reached the cloud/);
  });

  test('local-newer wins over stale-cloud when both are true', () => {
    const banner = backupBanner(
      prefs({
        lastRemoteSync: '2026-05-26T12:00:00.000Z', // 2 days ago
        lastLocalSync: '2026-05-28T11:59:00.000Z', // 1 min ago
      }),
      T0_MS,
    );
    expect(banner?.text).toMatch(/Local changes have not reached the cloud/);
  });

  test('stale-cloud fires when cloud is older than the threshold and local equals cloud', () => {
    const old = new Date(T0_MS - STALE_AFTER_MS - 1000).toISOString();
    const banner = backupBanner(
      prefs({ lastRemoteSync: old, lastLocalSync: old }),
      T0_MS,
    );
    expect(banner?.text).toMatch(/more than a day old/);
  });

  test('no banner when cloudSync on, recent remote sync, local equals remote', () => {
    expect(backupBanner(prefs(), T0_MS)).toBeNull();
  });

  test('no banner when lastLocalSync equals lastRemoteSync exactly (just-synced state)', () => {
    expect(
      backupBanner(
        prefs({ lastRemoteSync: T0, lastLocalSync: T0 }),
        T0_MS,
      ),
    ).toBeNull();
  });

  test('local-newer does not fire when lastLocalSync is null but lastRemoteSync exists', () => {
    // Pre-Tier-1-item-6 wallets that have not yet recorded a
    // lastLocalSync should not falsely trigger the new banner.
    const banner = backupBanner(
      prefs({ lastLocalSync: null }),
      T0_MS,
    );
    expect(banner).toBeNull();
  });
});

import { fileBackupBanner } from './backupBanner.ts';

describe('fileBackupBanner (sovereign build)', () => {
  const NOW = new Date('2026-11-23T12:00:00Z').getTime();
  test('never backed up: says the wallet is only on this device', () => {
    expect(fileBackupBanner({ localBackupDownloaded: false, lastFileBackupAt: null }, NOW)?.text).toMatch(/only on this device/);
  });
  test('downloaded before dates were kept: says the date is unknown, never claims fresh', () => {
    expect(fileBackupBanner({ localBackupDownloaded: true, lastFileBackupAt: null }, NOW)?.text).toMatch(/doesn't know when/);
  });
  test('recent file: no banner', () => {
    expect(fileBackupBanner({ localBackupDownloaded: true, lastFileBackupAt: '2026-11-01T12:00:00Z' }, NOW)).toBeNull();
  });
  test('30 days or older: reminds, with the age in days', () => {
    expect(fileBackupBanner({ localBackupDownloaded: true, lastFileBackupAt: '2026-10-24T12:00:00Z' }, NOW)?.text).toMatch(/30 days old/);
    expect(fileBackupBanner({ localBackupDownloaded: true, lastFileBackupAt: '2026-10-25T12:00:00Z' }, NOW)).toBeNull();
  });
});

import { backupStatusLine } from './backupBanner.ts';

describe('backupStatusLine (top of home, sovereign)', () => {
  const NOW = new Date('2026-11-23T12:00:00Z').getTime();
  const base = { localBackupDownloaded: true, lastLocalSync: null as string | null };
  test('never backed up: warns plainly', () => {
    expect(backupStatusLine({ ...base, localBackupDownloaded: false, lastFileBackupAt: null }, NOW)).toEqual({ tone: 'warn', text: 'Not backed up. If you lose this phone, the wallet is gone.' });
  });
  test('date unknown: never claims fresh', () => {
    expect(backupStatusLine({ ...base, lastFileBackupAt: null }, NOW).tone).toBe('warn');
  });
  test('recent with no wallet changes since: up to date', () => {
    expect(backupStatusLine({ ...base, lastFileBackupAt: '2026-11-23T09:00:00Z', lastLocalSync: '2026-11-23T08:00:00Z' }, NOW)).toEqual({ tone: 'ok', text: 'Last backup 3 hours ago · up to date' });
  });
  test('wallet changed after the backup: says so', () => {
    expect(backupStatusLine({ ...base, lastFileBackupAt: '2026-11-21T12:00:00Z', lastLocalSync: '2026-11-23T11:00:00Z' }, NOW)).toEqual({ tone: 'warn', text: 'Last backup 2 days ago · changes since' });
  });
  test('30 days old with no changes: time for a new one', () => {
    expect(backupStatusLine({ ...base, lastFileBackupAt: '2026-10-20T12:00:00Z' }, NOW).text).toBe('Last backup 34 days ago · time for a new one');
  });
});
