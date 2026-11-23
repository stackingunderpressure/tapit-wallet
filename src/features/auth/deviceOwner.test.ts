import { describe, expect, it, vi, beforeEach } from 'vitest';

const { store } = vi.hoisted(() => ({ store: new Map<string, unknown>() }));
vi.mock('../../shared/lib/idb.ts', () => ({
  idb: {
    get: async (k: string) => store.get(k),
    put: async (k: string, v: unknown) => { store.set(k, v); },
    entries: async () => [...store.entries()],
  },
}));

import { resolveDeviceOwnerId } from './deviceOwner.ts';

describe('resolveDeviceOwnerId', () => {
  beforeEach(() => store.clear());

  it('adopts the id of the wallet already on this device, so nothing moves', async () => {
    store.set('wallet:uid-hosted', { updated_at: '2026-11-20T00:00:00Z' });
    store.set('chat-threads:uid-hosted', {});
    expect(await resolveDeviceOwnerId(() => 'fresh')).toBe('uid-hosted');
    expect(store.get('chat-threads:uid-hosted')).toEqual({});
  });

  it('picks the most recently saved wallet when two accounts used this device', async () => {
    store.set('wallet:old', { updated_at: '2026-01-01T00:00:00Z' });
    store.set('wallet:new', { updated_at: '2026-11-01T00:00:00Z' });
    expect(await resolveDeviceOwnerId(() => 'fresh')).toBe('new');
  });

  it('gives a fresh device a new id, and the same id on every later run', async () => {
    expect(await resolveDeviceOwnerId(() => 'fresh-1')).toBe('fresh-1');
    store.set('wallet:someone-else', { updated_at: '2027-01-01T00:00:00Z' });
    expect(await resolveDeviceOwnerId(() => 'fresh-2')).toBe('fresh-1');
  });
});
