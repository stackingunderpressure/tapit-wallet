import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DEFAULT_RELAYS } from '../transport/defaultRelays.ts';

// Mock the idb wrapper so we don't need a real IndexedDB in
// the test environment. The mock holds an in-memory map keyed
// the way the real idb.put / idb.get pair does.

const store = new Map<string, unknown>();

vi.mock('../../shared/lib/idb.ts', () => ({
  idb: {
    get: async <T>(key: string): Promise<T | undefined> =>
      store.get(key) as T | undefined,
    put: async (key: string, value: unknown): Promise<void> => {
      store.set(key, value);
    },
    delete: async (key: string): Promise<void> => {
      store.delete(key);
    },
  },
}));

import { prefsStore } from './prefsStore.ts';
import type { Prefs } from './prefsStore.ts';

const OWNER = 'op-2026-05-30';

function basePrefs(overrides: Partial<Prefs> = {}): Prefs {
  return {
    cloudSync: true,
    lastRemoteSync: null,
    lastLocalSync: null,
    lastRemoteFailedSync: null,
    idleTimeoutMs: 30 * 60 * 1000,
    nostrTransportEnabled: true,
    nostrRelays: ['wss://default.example'],
    theme: 'fresh',
    streaksEnabled: true,
    memoriesEnabled: true,
    vouchingCirclePubkeys: [],
    ...overrides,
  };
}

describe('prefsStore relay-recovery (operator bug 2026-05-30)', () => {
  beforeEach(() => {
    store.clear();
  });

  it('fresh wallet loads with DEFAULT_RELAYS (no saved prefs)', async () => {
    const loaded = await prefsStore.load(OWNER);
    expect(loaded.nostrRelays).toEqual([...DEFAULT_RELAYS]);
    expect(loaded.nostrTransportEnabled).toBe(true);
  });

  it('saved prefs with non-empty relays are preserved verbatim', async () => {
    const custom = ['wss://my-private.relay'];
    await prefsStore.save(OWNER, basePrefs({ nostrRelays: custom }));
    const loaded = await prefsStore.load(OWNER);
    expect(loaded.nostrRelays).toEqual(custom);
  });

  it('recovers DEFAULT_RELAYS when saved prefs have empty nostrRelays', async () => {
    // The bug: the prior WalletProvider initial state had
    // nostrRelays: [] which could leak to disk via an updatePrefs
    // race firing before prefsStore.load completed. Object-spread
    // merge does not heal array replacement, so the empty array
    // would win forever over DEFAULT_PREFS.nostrRelays — the
    // wallet would then publish to and subscribe from zero relays
    // and messages + envelopes would silently fail in both
    // directions.
    await prefsStore.save(OWNER, basePrefs({ nostrRelays: [] }));
    const loaded = await prefsStore.load(OWNER);
    // The recovery path must restore DEFAULT_RELAYS so the wallet
    // has at least the baseline substrate to publish to.
    expect(loaded.nostrRelays).toEqual([...DEFAULT_RELAYS]);
  });
});
