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
    ...partial,
  };
}

describe('backupBanner', () => {
  test('cloudSync off wins over everything', () => {
    const banner = backupBanner(prefs({ cloudSync: false }));
    expect(banner?.text).toMatch(/Cloud backup is off/);
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
