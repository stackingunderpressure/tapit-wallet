import { describe, expect, it, vi, beforeEach } from 'vitest';

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

import { requestHistoryStore, type RequestHistoryEntry } from './requestHistoryStore.ts';

const OWNER = 'op-2026-08-11';
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
  beforeEach(() => store.clear());

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
});
