import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the idb wrapper with an in-memory map, same pattern as
// prefsStore.test.ts, so no real IndexedDB is needed.
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

import { dismissedInboxStore } from './dismissedInboxStore.ts';

const OWNER = 'op-2026-05-31';

describe('dismissedInboxStore', () => {
  beforeEach(() => store.clear());

  it('loads an empty set when nothing was ever dismissed', async () => {
    const set = await dismissedInboxStore.load(OWNER);
    expect(set.size).toBe(0);
  });

  it('persists a dismissed envelopeId and reloads it', async () => {
    await dismissedInboxStore.add(OWNER, 'abc123');
    const set = await dismissedInboxStore.load(OWNER);
    expect(set.has('abc123')).toBe(true);
  });

  it('add returns the updated set including the new id', async () => {
    const set = await dismissedInboxStore.add(OWNER, 'deadbeef');
    expect(set.has('deadbeef')).toBe(true);
  });

  it('is idempotent — dismissing the same id twice keeps one entry', async () => {
    await dismissedInboxStore.add(OWNER, 'dup');
    await dismissedInboxStore.add(OWNER, 'dup');
    const set = await dismissedInboxStore.load(OWNER);
    expect([...set].filter((x) => x === 'dup')).toHaveLength(1);
  });

  it('scopes dismissals per owner', async () => {
    await dismissedInboxStore.add(OWNER, 'mine');
    const other = await dismissedInboxStore.load('someone-else');
    expect(other.has('mine')).toBe(false);
  });

  it('accumulates multiple distinct ids', async () => {
    await dismissedInboxStore.add(OWNER, 'one');
    await dismissedInboxStore.add(OWNER, 'two');
    const set = await dismissedInboxStore.load(OWNER);
    expect(set.has('one')).toBe(true);
    expect(set.has('two')).toBe(true);
    expect(set.size).toBe(2);
  });
});
