import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { EncryptedBlob } from 'tapit-attest';

// Mock the idb wrapper with an in-memory map, same pattern as
// dismissedInboxStore.test.ts, so no real IndexedDB is needed.
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

// Mock the Supabase-backed remote store the same way
// requestHistoryStore.test.ts does.
const remote = new Map<string, EncryptedBlob>();

vi.mock('./remoteRequestStateStore.ts', () => ({
  remoteRequestStateStore: {
    get: async (ownerId: string, storeKey: string): Promise<EncryptedBlob | undefined> =>
      remote.get(`${ownerId}:${storeKey}`),
    put: async (ownerId: string, storeKey: string, blob: EncryptedBlob): Promise<void> => {
      remote.set(`${ownerId}:${storeKey}`, blob);
    },
  },
}));

import {
  dismissedRequestsStore,
  pushDismissedRequestsBackup,
  restoreDismissedRequestsBackup,
} from './dismissedRequestsStore.ts';

const OWNER = 'op-2026-08-14';
const PASSPHRASE = 'correct horse battery staple';
const NAMESPACE = 'psbt-cosign';

describe('dismissedRequestsStore', () => {
  beforeEach(() => {
    store.clear();
    remote.clear();
  });

  it('loads an empty set when nothing was ever dismissed', async () => {
    const set = await dismissedRequestsStore.load(OWNER, NAMESPACE);
    expect(set.size).toBe(0);
  });

  it('persists a dismissed key and reloads it', async () => {
    await dismissedRequestsStore.add(OWNER, NAMESPACE, 'evt-1');
    const set = await dismissedRequestsStore.load(OWNER, NAMESPACE);
    expect(set.has('evt-1')).toBe(true);
  });

  it('scopes dismissals per namespace so psbt-cosign and vault-membership never collide', async () => {
    await dismissedRequestsStore.add(OWNER, 'psbt-cosign', 'shared-key');
    const other = await dismissedRequestsStore.load(OWNER, 'vault-membership');
    expect(other.has('shared-key')).toBe(false);
  });

  describe('cloud backup (2026-08-14, operator: "They are all old... we can anticipate it would happen again")', () => {
    it('round-trips dismissals through push and restore on a fresh device', async () => {
      await dismissedRequestsStore.add(OWNER, 'psbt-cosign', 'evt-a');
      await dismissedRequestsStore.add(OWNER, 'vault-membership', 'vault-desc::heir');
      await pushDismissedRequestsBackup(OWNER, PASSPHRASE);

      // Simulate a fresh sign-in / wiped IndexedDB: local storage empty,
      // only the encrypted remote backup exists.
      store.clear();
      expect((await dismissedRequestsStore.load(OWNER, 'psbt-cosign')).has('evt-a')).toBe(false);

      await restoreDismissedRequestsBackup(OWNER, PASSPHRASE);
      expect((await dismissedRequestsStore.load(OWNER, 'psbt-cosign')).has('evt-a')).toBe(true);
      expect(
        (await dismissedRequestsStore.load(OWNER, 'vault-membership')).has('vault-desc::heir'),
      ).toBe(true);
    });

    it('never stores dismissed keys in the clear remotely', async () => {
      await dismissedRequestsStore.add(OWNER, NAMESPACE, 'a-real-event-id-should-not-leak');
      await pushDismissedRequestsBackup(OWNER, PASSPHRASE);
      const raw = JSON.stringify(remote.get(`${OWNER}:dismissed-requests:${NAMESPACE}`));
      expect(raw).not.toContain('a-real-event-id-should-not-leak');
    });

    it('merges remote dismissals into local without dropping anything already dismissed locally', async () => {
      await dismissedRequestsStore.add(OWNER, NAMESPACE, 'from-remote');
      await pushDismissedRequestsBackup(OWNER, PASSPHRASE);

      // A second device (or a later session on this one) dismissed a
      // DIFFERENT event that never made it into the pushed snapshot.
      store.clear();
      await dismissedRequestsStore.add(OWNER, NAMESPACE, 'local-only');

      await restoreDismissedRequestsBackup(OWNER, PASSPHRASE);
      const set = await dismissedRequestsStore.load(OWNER, NAMESPACE);
      expect(set.has('from-remote')).toBe(true);
      expect(set.has('local-only')).toBe(true);
    });

    it('is a no-op when there is nothing to restore yet', async () => {
      await restoreDismissedRequestsBackup(OWNER, PASSPHRASE);
      const set = await dismissedRequestsStore.load(OWNER, NAMESPACE);
      expect(set.size).toBe(0);
    });
  });
});
