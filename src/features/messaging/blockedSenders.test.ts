import { describe, expect, it, vi, beforeEach } from 'vitest';

const { store } = vi.hoisted(() => ({ store: new Map<string, unknown>() }));
vi.mock('../../shared/lib/idb.ts', () => ({
  idb: {
    get: async (k: string) => store.get(k),
    put: async (k: string, v: unknown) => { store.set(k, v); },
  },
}));

import { addBlockedSender, loadBlockedSenders } from './blockedSenders.ts';

describe('blocked senders', () => {
  beforeEach(() => store.clear());

  it('starts empty, remembers a block across loads, ignores letter case', async () => {
    expect((await loadBlockedSenders('o')).size).toBe(0);
    await addBlockedSender('o', 'ABCDEF');
    const set = await loadBlockedSenders('o');
    expect(set.has('abcdef')).toBe(true);
    expect(set.size).toBe(1);
  });

  it('keeps each owner separate', async () => {
    await addBlockedSender('o1', 'aa');
    expect((await loadBlockedSenders('o2')).has('aa')).toBe(false);
  });
});
