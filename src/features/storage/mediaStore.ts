import { idb } from '../../shared/lib/idb.ts';
import { encrypt, decrypt, type EncryptedBlob } from 'tapit-attest';
import { sha256 } from '@noble/hashes/sha256';

// Media storage — encrypted client-side, lives in IndexedDB. Each
// blob is keyed by its SHA-256 (the same hash that goes into the
// attestation's claim leaf, so the attestation tamper-evidently
// commits to this exact bytes), and the encrypted form is what the
// browser holds. The host never sees plaintext. The hash key means
// duplicate uploads collapse to one row by construction.

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
    s += (c === undefined ? '00' : c.toString(16).padStart(2, '0'));
  }
  return s;
}

export interface PutResult {
  hashHex: string;
  byteLength: number;
}

export const mediaStore = {
  /** Hash, encrypt, persist. Returns the hex SHA-256 to write into the claim. */
  async put(
    ownerId: string,
    passphrase: string,
    bytes: Uint8Array,
    mime: string,
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
    return { hashHex, byteLength: bytes.length };
  },

  /** Read raw bytes back out. Returns undefined if the row is missing. */
  async get(
    ownerId: string,
    passphrase: string,
    hashHex: string,
  ): Promise<{ bytes: Uint8Array; mime: string } | undefined> {
    const record = await idb.get<StoredMedia>(KEY(ownerId, hashHex));
    if (!record) return undefined;
    return { bytes: decrypt(record.blob, passphrase), mime: record.mime };
  },

  /** Metadata-only read for listings — no decryption needed. */
  async stat(ownerId: string, hashHex: string): Promise<StoredMedia | undefined> {
    return idb.get<StoredMedia>(KEY(ownerId, hashHex));
  },

  async delete(ownerId: string, hashHex: string): Promise<void> {
    await idb.delete(KEY(ownerId, hashHex));
  },
};
