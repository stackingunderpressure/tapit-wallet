import type { EncryptedBlob } from 'tapit-attest';
import { idb } from '../../shared/lib/idb.ts';

// Local persistence of the encrypted wallet snapshot. IndexedDB is
// the cheapest layer of the three-layer backup model (DESIGN.md §6):
// offline-fast, survives a page reload, and lives only on the user's
// device. The blob is ciphertext — IndexedDB is dumb storage too.

export interface StoredBlob {
  blob: EncryptedBlob;
  updated_at: string;
}

const KEY = (ownerId: string) => `wallet:${ownerId}`;

export const localStore = {
  async get(ownerId: string): Promise<StoredBlob | undefined> {
    return idb.get<StoredBlob>(KEY(ownerId));
  },
  async put(ownerId: string, value: StoredBlob): Promise<void> {
    await idb.put(KEY(ownerId), value);
  },
  async clear(ownerId: string): Promise<void> {
    await idb.delete(KEY(ownerId));
  },
};
