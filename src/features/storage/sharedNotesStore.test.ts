import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { sharedNotesStore } from './sharedNotesStore.ts';

const OWNER = 'op-2026-06-01';

describe('sharedNotesStore', () => {
  beforeEach(() => store.clear());

  it('loads an empty map when nothing was shared', async () => {
    expect(await sharedNotesStore.load(OWNER)).toEqual({});
  });

  it('records a shared entry with its note event id', async () => {
    await sharedNotesStore.markShared(OWNER, 'entry-1', 'note-abc');
    const map = await sharedNotesStore.load(OWNER);
    expect(map['entry-1']).toBe('note-abc');
  });

  it('markShared returns the updated map', async () => {
    const map = await sharedNotesStore.markShared(OWNER, 'entry-1', 'note-abc');
    expect(map['entry-1']).toBe('note-abc');
  });

  it('overwrites the note id on re-share', async () => {
    await sharedNotesStore.markShared(OWNER, 'entry-1', 'note-old');
    await sharedNotesStore.markShared(OWNER, 'entry-1', 'note-new');
    expect((await sharedNotesStore.load(OWNER))['entry-1']).toBe('note-new');
  });

  it('keeps multiple shared entries', async () => {
    await sharedNotesStore.markShared(OWNER, 'entry-1', 'note-1');
    await sharedNotesStore.markShared(OWNER, 'entry-2', 'note-2');
    const map = await sharedNotesStore.load(OWNER);
    expect(Object.keys(map)).toHaveLength(2);
  });

  it('scopes shares per owner', async () => {
    await sharedNotesStore.markShared(OWNER, 'entry-1', 'note-1');
    expect(await sharedNotesStore.load('someone-else')).toEqual({});
  });
});
