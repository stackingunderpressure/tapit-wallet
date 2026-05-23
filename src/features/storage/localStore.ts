import type { EncryptedBlob, RecoverableEncryptedBlob } from 'tapit-attest';
import { idb } from '../../shared/lib/idb.ts';

// Local persistence of the encrypted wallet snapshot. IndexedDB is
// the cheapest layer of the three-layer backup model (DESIGN.md §6):
// offline-fast, survives a page reload, and lives only on the user's
// device. The blob is ciphertext — IndexedDB is dumb storage too.
//
// Phase 5e-iii-b-2 makes StoredBlob a union: v1 (passphrase-only
// PBKDF2 → AES-GCM, the original shape) OR v2 (recoverable —
// passphrase-wrap plus Shamir-cascade path for K_data). Legacy v1
// blobs in existing users' IndexedDB stay readable; new saves write
// v2 going forward.

/** A v1 (legacy) or v2 (recoverable) encrypted blob. Distinguished by `v`. */
export type AnyEncryptedBlob = EncryptedBlob | RecoverableEncryptedBlob;

export interface StoredBlob {
  blob: AnyEncryptedBlob;
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
