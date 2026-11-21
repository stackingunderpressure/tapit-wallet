import { describe, expect, it, vi } from 'vitest';
import { requestPersistentStorage } from './persistence.ts';

describe('requestPersistentStorage', () => {
  it('reports unsupported when the browser has no storage manager', async () => {
    expect(await requestPersistentStorage(undefined)).toBe('unsupported');
    expect(await requestPersistentStorage({})).toBe('unsupported');
  });

  it('reports granted when the browser grants the request', async () => {
    const m = { persist: vi.fn(async () => true), persisted: vi.fn(async () => false) };
    expect(await requestPersistentStorage(m)).toBe('granted');
    expect(m.persist).toHaveBeenCalledOnce();
  });

  it('reports not-granted when the browser refuses, and never claims otherwise', async () => {
    const m = { persist: vi.fn(async () => false), persisted: vi.fn(async () => false) };
    expect(await requestPersistentStorage(m)).toBe('not-granted');
  });

  it('does not ask again when the browser already keeps the data', async () => {
    const m = { persist: vi.fn(async () => true), persisted: vi.fn(async () => true) };
    expect(await requestPersistentStorage(m)).toBe('granted');
    expect(m.persist).not.toHaveBeenCalled();
  });

  it('treats a failing browser call as unsupported rather than granted', async () => {
    const m = { persist: vi.fn(async () => { throw new Error('nope'); }) };
    expect(await requestPersistentStorage(m)).toBe('unsupported');
  });
});
