import { idb } from '../../shared/lib/idb.ts';
import { encrypt, decrypt, type EncryptedBlob } from 'tapit-attest';
import { sha256 } from '@noble/hashes/sha256';
import { remoteMediaStore } from './remoteMediaStore.ts';

// Media storage — encrypted client-side, lives in IndexedDB as
// authoritative-local copy. When cloud-sync is enabled in Settings,
// the same encrypted bytes are mirrored to Supabase Storage (the
// `wallet_media` bucket) so a lost phone can be restored on a new
// device. The host sees ciphertext only — encryption happens once
// at put-time and the same EncryptedBlob is used for both stores.
//
// On get: try local IDB first (cheap), fall back to remote if the
// local copy is missing (the new-device restore path), and cache
// the fetched EncryptedBlob locally for next time without re-
// encrypting. The hash key means duplicate uploads collapse to one
// row by construction.

const KEY = (ownerId: string, hashHex: string) => `media:${ownerId}:${hashHex}`;

export interface StoredMedia {
  blob: EncryptedBlob;
  mime: string;
  byteLength: number;
  stored_at: string;
}

function toHex(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    s += c === undefined ? '00' : c.toString(16).padStart(2, '0');
  }
  return s;
}

export interface PutResult {
  hashHex: string;
  byteLength: number;
  /** True if the remote mirror was attempted and succeeded.
   *  False when cloud-sync was off (skipped) or when the remote
   *  push threw — local always succeeds for the caller path. */
  remoteSynced: boolean;
}

export const mediaStore = {
  /**
   * Hash, encrypt, persist locally; if cloudSync is true also push
   * the encrypted blob to Supabase Storage. Returns the hex SHA-256
   * (to write into the claim leaf) and whether the remote mirror
   * succeeded. Local save never fails the caller; remote failures
   * are logged and swallowed so the user can keep working offline
   * and the next save can reconcile.
   */
  async put(
    ownerId: string,
    passphrase: string,
    bytes: Uint8Array,
    mime: string,
    cloudSync: boolean,
  ): Promise<PutResult> {
    const hashHex = toHex(sha256(bytes));
    const blob = encrypt(bytes, passphrase);
    const record: StoredMedia = {
      blob,
      mime,
      byteLength: bytes.length,
      stored_at: new Date().toISOString(),
    };
    await idb.put(KEY(ownerId, hashHex), record);
    let remoteSynced = false;
    if (cloudSync) {
      try {
        await remoteMediaStore.put(ownerId, hashHex, blob, mime);
        remoteSynced = true;
      } catch (err) {
        console.warn('remoteMediaStore.put failed; local save succeeded', err);
      }
    }
    return { hashHex, byteLength: bytes.length, remoteSynced };
  },

  /**
   * Read raw bytes back out. Local-first; remote-fallback when the
   * local copy is missing (the new-device restore path). A remote
   * hit caches the EncryptedBlob into local IDB without
   * re-encrypting so subsequent reads are cheap.
   */
  async get(
    ownerId: string,
    passphrase: string,
    hashHex: string,
  ): Promise<{ bytes: Uint8Array; mime: string } | undefined> {
    let record = await idb.get<StoredMedia>(KEY(ownerId, hashHex));
    if (!record) {
      try {
        const remote = await remoteMediaStore.get(ownerId, hashHex);
        if (remote) {
          record = {
            blob: remote.blob,
            mime: remote.mime,
            byteLength: 0,
            stored_at: new Date().toISOString(),
          };
          // Cache the EncryptedBlob locally so the next read is
          // local-fast. Storing the blob we received as-is — no
          // re-encrypt under a (possibly different) passphrase.
          await idb.put(KEY(ownerId, hashHex), record);
        }
      } catch (err) {
        console.warn('remoteMediaStore.get failed; falling through', err);
      }
    }
    if (!record) return undefined;
    return { bytes: decrypt(record.blob, passphrase), mime: record.mime };
  },

  /** Metadata-only read for listings — no decryption needed. Local only. */
  async stat(ownerId: string, hashHex: string): Promise<StoredMedia | undefined> {
    return idb.get<StoredMedia>(KEY(ownerId, hashHex));
  },

  /** Delete locally; the caller decides whether to also remove the
   *  remote mirror via remoteMediaStore.delete. v1 UI does not call
   *  this; it exists for completeness. */
  async delete(ownerId: string, hashHex: string): Promise<void> {
    await idb.delete(KEY(ownerId, hashHex));
  },
};
