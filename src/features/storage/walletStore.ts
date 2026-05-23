import { localStore, type AnyEncryptedBlob, type StoredBlob } from './localStore.ts';
import { remoteStore } from './remoteStore.ts';
import { prefsStore } from './prefsStore.ts';

// Coordinator: local + remote with last-write-wins on updated_at.
// On load, prefer the fresher of the two; on save, write local
// unconditionally and remote only if cloud-sync is enabled. Remote
// write failures don't block the local save — the user can keep
// working offline and the next save will reconcile. Successful
// remote writes update prefs.lastRemoteSync for the home-screen
// backup-stale banner.
//
// Phase 5e-iii-b-2: blob is now AnyEncryptedBlob (v1 or v2). The
// storage layer is format-agnostic; the wallet-core unlock + save
// paths handle the version dispatch.

export interface SaveOutcome {
  /** ISO timestamp of the local save (always set). */
  localSyncedAt: string;
  /** ISO timestamp of the remote save; null if remote was skipped or failed. */
  remoteSyncedAt: string | null;
  /** True only when remote was attempted and failed. */
  remoteFailed: boolean;
}

export const walletStore = {
  /** Load the freshest blob for this owner across local + remote. */
  async load(ownerId: string): Promise<StoredBlob | undefined> {
    const prefs = await prefsStore.load(ownerId);
    const [local, remote] = await Promise.allSettled([
      localStore.get(ownerId),
      prefs.cloudSync
        ? remoteStore.get(ownerId).catch(() => undefined)
        : Promise.resolve(undefined),
    ]);
    const l = local.status === 'fulfilled' ? local.value : undefined;
    const r = remote.status === 'fulfilled' ? remote.value : undefined;
    if (!l && !r) return undefined;
    if (!l) return r;
    if (!r) return l;
    return l.updated_at >= r.updated_at ? l : r;
  },

  /**
   * Save a freshly-encrypted snapshot. Always writes local.
   * Writes remote when cloud-sync is enabled; on remote success
   * updates prefs.lastRemoteSync. On remote failure the local save
   * still stands and the caller can decide how to surface it.
   */
  async save(ownerId: string, blob: AnyEncryptedBlob): Promise<SaveOutcome> {
    const now = new Date().toISOString();
    const value: StoredBlob = { blob, updated_at: now };
    await localStore.put(ownerId, value);

    const prefs = await prefsStore.load(ownerId);
    if (!prefs.cloudSync) {
      return { localSyncedAt: now, remoteSyncedAt: null, remoteFailed: false };
    }
    try {
      await remoteStore.put(ownerId, value);
      await prefsStore.save(ownerId, { ...prefs, lastRemoteSync: now });
      return { localSyncedAt: now, remoteSyncedAt: now, remoteFailed: false };
    } catch (err) {
      console.warn('remoteStore.put failed; local save succeeded', err);
      return { localSyncedAt: now, remoteSyncedAt: null, remoteFailed: true };
    }
  },
};
