import { describe, expect, test } from 'vitest';
import { isBackupStale } from './useAutoBackup.ts';
import type { Prefs } from '../storage/prefsStore.ts';

// Only the pure staleness decision is unit-tested here; the effect's
// once-per-unlock ref-guard wiring is integration behavior covered by
// the WalletProvider in the running app. STALE_AFTER_MS is 24h.
const DAY = 24 * 60 * 60 * 1000;

function prefs(over: Partial<Prefs>): Prefs {
  return {
    cloudSync: true,
    lastRemoteSync: null,
    lastLocalSync: null,
    lastRemoteFailedSync: null,
    idleTimeoutMs: 0,
    nostrTransportEnabled: false,
    nostrRelays: [],
    theme: 'fresh',
    streaksEnabled: true,
    memoriesEnabled: true,
    vouchingCirclePubkeys: [],
    recoveryKeySeen: false,
    localBackupDownloaded: false,
    ...over,
  };
}

const NOW = Date.parse('2026-06-03T12:00:00Z');

describe('isBackupStale', () => {
  test('false when cloud-sync is off (banner shows the off-state, not a retry case)', () => {
    expect(isBackupStale(prefs({ cloudSync: false }), NOW)).toBe(false);
  });

  test('true when a successful sync has never happened', () => {
    expect(isBackupStale(prefs({ lastRemoteSync: null }), NOW)).toBe(true);
  });

  test('true when a remote failure flag is sticky', () => {
    expect(
      isBackupStale(
        prefs({
          lastRemoteSync: new Date(NOW - 1000).toISOString(),
          lastRemoteFailedSync: new Date(NOW - 500).toISOString(),
        }),
        NOW,
      ),
    ).toBe(true);
  });

  test('true when the last sync is older than the staleness threshold', () => {
    expect(
      isBackupStale(
        prefs({ lastRemoteSync: new Date(NOW - DAY - 1000).toISOString() }),
        NOW,
      ),
    ).toBe(true);
  });

  test('false when a recent successful sync exists and no failure flag', () => {
    expect(
      isBackupStale(
        prefs({ lastRemoteSync: new Date(NOW - 60 * 1000).toISOString() }),
        NOW,
      ),
    ).toBe(false);
  });

  test('exactly at the threshold is not yet stale (strictly greater triggers)', () => {
    expect(
      isBackupStale(
        prefs({ lastRemoteSync: new Date(NOW - DAY).toISOString() }),
        NOW,
      ),
    ).toBe(false);
  });
});
