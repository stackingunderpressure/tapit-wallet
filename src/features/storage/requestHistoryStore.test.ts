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

// Mock the Supabase-backed remote store with an in-memory map keyed by
// "ownerId:storeKey", same shape (an opaque ciphertext blob) as the real
// thing -- same pattern circlePhrase.test.ts already established.
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
  requestHistoryStore,
  pushRequestHistoryBackup,
  restoreRequestHistoryBackup,
  type RequestHistoryEntry,
} from './requestHistoryStore.ts';

const OWNER = 'op-2026-08-11';
const PASSPHRASE = 'correct horse battery staple';
const NAMESPACE = 'psbt-cosign';

function entry(overrides: Partial<RequestHistoryEntry> = {}): RequestHistoryEntry {
  return {
    id: 'evt-1',
    summary: 'DynastyTrust',
    detail: 'Family Trust',
    receivedAt: 1000,
    status: 'pending',
    respondedAt: null,
    ...overrides,
  };
}

describe('requestHistoryStore', () => {
  beforeEach(() => {
    store.clear();
    remote.clear();
  });

  it('loads an empty list when nothing was ever recorded', async () => {
    const history = await requestHistoryStore.load(OWNER, NAMESPACE);
    expect(history).toEqual([]);
  });

  it('persists a new entry and reloads it', async () => {
    await requestHistoryStore.upsert(OWNER, NAMESPACE, entry());
    const history = await requestHistoryStore.load(OWNER, NAMESPACE);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ id: 'evt-1', status: 'pending' });
  });

  it('upserting the same id replaces the entry instead of duplicating it -- pending becomes reviewed', async () => {
    await requestHistoryStore.upsert(OWNER, NAMESPACE, entry({ status: 'pending' }));
    await requestHistoryStore.upsert(
      OWNER,
      NAMESPACE,
      entry({ status: 'reviewed', respondedAt: 2000 }),
    );
    const history = await requestHistoryStore.load(OWNER, NAMESPACE);
    expect(history).toHaveLength(1);
    expect(history[0]!.status).toBe('reviewed');
    expect(history[0]!.respondedAt).toBe(2000);
  });

  it('sorts newest received first', async () => {
    await requestHistoryStore.upsert(OWNER, NAMESPACE, entry({ id: 'a', receivedAt: 100 }));
    await requestHistoryStore.upsert(OWNER, NAMESPACE, entry({ id: 'b', receivedAt: 300 }));
    await requestHistoryStore.upsert(OWNER, NAMESPACE, entry({ id: 'c', receivedAt: 200 }));
    const history = await requestHistoryStore.load(OWNER, NAMESPACE);
    expect(history.map((h) => h.id)).toEqual(['b', 'c', 'a']);
  });

  it('remove deletes exactly one entry by id', async () => {
    await requestHistoryStore.upsert(OWNER, NAMESPACE, entry({ id: 'keep' }));
    await requestHistoryStore.upsert(OWNER, NAMESPACE, entry({ id: 'drop' }));
    await requestHistoryStore.remove(OWNER, NAMESPACE, 'drop');
    const history = await requestHistoryStore.load(OWNER, NAMESPACE);
    expect(history.map((h) => h.id)).toEqual(['keep']);
  });

  it('scopes history per namespace so psbt-cosign and vault-membership never collide', async () => {
    await requestHistoryStore.upsert(OWNER, 'psbt-cosign', entry({ id: 'shared-id' }));
    const otherNamespace = await requestHistoryStore.load(OWNER, 'vault-membership');
    expect(otherNamespace).toEqual([]);
  });

  it('scopes history per owner', async () => {
    await requestHistoryStore.upsert(OWNER, NAMESPACE, entry());
    const other = await requestHistoryStore.load('someone-else', NAMESPACE);
    expect(other).toEqual([]);
  });

  describe('cloud backup (2026-08-14, operator: "They are all old... we can anticipate it would happen again")', () => {
    it('round-trips history through push and restore on a fresh device', async () => {
      await requestHistoryStore.upsert(OWNER, 'psbt-cosign', entry({ id: 'a' }));
      await requestHistoryStore.upsert(OWNER, 'vault-membership', entry({ id: 'b', summary: 'A vault' }));
      await pushRequestHistoryBackup(OWNER, PASSPHRASE);

      // Simulate a fresh sign-in / wiped IndexedDB: local storage empty,
      // only the encrypted remote backup exists.
      store.clear();
      expect(await requestHistoryStore.load(OWNER, 'psbt-cosign')).toEqual([]);

      await restoreRequestHistoryBackup(OWNER, PASSPHRASE);
      const restored = await requestHistoryStore.load(OWNER, 'psbt-cosign');
      expect(restored.map((e) => e.id)).toEqual(['a']);
      const restoredOther = await requestHistoryStore.load(OWNER, 'vault-membership');
      expect(restoredOther.map((e) => e.id)).toEqual(['b']);
    });

    it('never stores history content in the clear remotely', async () => {
      await requestHistoryStore.upsert(OWNER, NAMESPACE, entry({ summary: 'DynastyTrust -- Family savings' }));
      await pushRequestHistoryBackup(OWNER, PASSPHRASE);
      const raw = JSON.stringify(remote.get(`${OWNER}:request-history:${NAMESPACE}`));
      expect(raw).not.toContain('Family savings');
    });

    it('a delete followed by a fresh push keeps the deletion durable through a later restore', async () => {
      // Mirrors the real call sequence usePsbtCosignRequests.ts /
      // useVaultMembershipRequests.ts actually use: deleteHistoryEntry
      // always re-pushes immediately after removing locally, so the
      // remote snapshot reflects the deletion before any restore can
      // see a stale copy. (Deliberately NOT guaranteed if a restore
      // races a delete's push before it completes -- e.g. offline --
      // this store has no tombstone mechanism; that's an accepted
      // best-effort gap on convenience/dismissal state, not a promise
      // this test should claim.)
      await requestHistoryStore.upsert(OWNER, NAMESPACE, entry({ id: 'keep-me' }));
      await requestHistoryStore.upsert(OWNER, NAMESPACE, entry({ id: 'delete-me' }));
      await pushRequestHistoryBackup(OWNER, PASSPHRASE);

      await requestHistoryStore.remove(OWNER, NAMESPACE, 'delete-me');
      await pushRequestHistoryBackup(OWNER, PASSPHRASE);

      await restoreRequestHistoryBackup(OWNER, PASSPHRASE);
      const history = await requestHistoryStore.load(OWNER, NAMESPACE);
      expect(history.map((e) => e.id)).toEqual(['keep-me']);
    });
  });
});
