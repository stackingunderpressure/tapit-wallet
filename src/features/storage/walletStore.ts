import type { EncryptedBlob } from 'tapit-attest';
import { localStore, type StoredBlob } from './localStore.ts';
import { remoteStore } from './remoteStore.ts';

// Coordinator: local + remote with last-write-wins on updated_at.
// On load, prefer the fresher of the two; on save, write both.
// Remote write failures don't block the local save — the user can
// keep working offline and the next save will reconcile.

export const walletStore = {
  /** Load the freshest blob for this owner across local + remote. */
  async load(ownerId: string): Promise<StoredBlob | undefined> {
    const [local, remote] = await Promise.allSettled([
      localStore.get(ownerId),
      remoteStore.get(ownerId).catch(() => undefined),
    ]);
    const l = local.status === 'fulfilled' ? local.value : undefined;
    const r = remote.status === 'fulfilled' ? remote.value : undefined;
    if (!l && !r) return undefined;
    if (!l) return r;
    if (!r) return l;
    return l.updated_at >= r.updated_at ? l : r;
  },

  /** Save a freshly-encrypted snapshot to both stores. */
  async save(ownerId: string, blob: EncryptedBlob): Promise<StoredBlob> {
    const value: StoredBlob = { blob, updated_at: new Date().toISOString() };
    await localStore.put(ownerId, value);
    try {
      await remoteStore.put(ownerId, value);
    } catch (err) {
      console.warn('remoteStore.put failed; local save succeeded', err);
    }
    return value;
  },
};
