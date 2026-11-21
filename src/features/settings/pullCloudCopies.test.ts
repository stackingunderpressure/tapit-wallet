import { describe, expect, it, vi, beforeEach } from 'vitest';

const { store, remote, circle } = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  remote: { listHashes: vi.fn(), get: vi.fn() },
  circle: vi.fn(),
}));
vi.mock('../../shared/lib/idb.ts', () => ({
  idb: {
    get: async (k: string) => store.get(k),
    put: async (k: string, v: unknown) => { store.set(k, v); },
  },
}));
vi.mock('../storage/remoteMediaStore.ts', () => ({ remoteMediaStore: remote }));
vi.mock('../circle-phrase/circlePhrase.ts', () => ({ restoreCirclePhraseBackup: circle }));
vi.mock('../storage/requestHistoryStore.ts', () => ({ restoreRequestHistoryBackup: vi.fn(async () => {}) }));
vi.mock('../storage/dismissedRequestsStore.ts', () => ({ restoreDismissedRequestsBackup: vi.fn(async () => {}) }));

import { pullCloudCopies } from './pullCloudCopies.ts';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const C = 'c'.repeat(64);

describe('pullCloudCopies', () => {
  beforeEach(() => { store.clear(); vi.clearAllMocks(); });

  it('fetches only the attachments this device is missing, keeping them encrypted', async () => {
    store.set(`media:o:${A}`, { have: true });
    remote.listHashes.mockResolvedValue([A, B]);
    remote.get.mockResolvedValue({ blob: { v: 1, ciphertext: 'ff' }, mime: 'image/jpeg' });
    circle.mockResolvedValue(undefined);
    const r = await pullCloudCopies('o', 'p');
    expect(r).toEqual({ mediaFetched: 1, mediaFailed: 0, problems: [] });
    expect(remote.get).toHaveBeenCalledOnce();
    expect(store.get(`media:o:${B}`)).toMatchObject({ blob: { v: 1, ciphertext: 'ff' }, mime: 'image/jpeg' });
    expect(store.get(`media:o:${A}`)).toEqual({ have: true });
  });

  it('says what it could not fetch instead of hiding it', async () => {
    remote.listHashes.mockResolvedValue([B, C]);
    remote.get.mockRejectedValueOnce(new Error('net')).mockResolvedValueOnce({ blob: {}, mime: 'x' });
    circle.mockRejectedValue(new Error('net'));
    const r = await pullCloudCopies('o', 'p');
    expect(r.mediaFetched).toBe(1);
    expect(r.mediaFailed).toBe(1);
    expect(r.problems).toEqual([
      'Could not fetch the cloud copy of circle phrases.',
      '1 attachment(s) could not be fetched from the cloud.',
    ]);
  });

  it('reports an attachment listing failure', async () => {
    remote.listHashes.mockRejectedValue(new Error('down'));
    circle.mockResolvedValue(undefined);
    const r = await pullCloudCopies('o', 'p');
    expect(r.problems).toEqual(['Could not list attachments in the cloud.']);
  });
});
