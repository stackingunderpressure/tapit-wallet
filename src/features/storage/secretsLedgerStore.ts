import { encrypt, decrypt, type EncryptedBlob } from 'tapit-attest';
import { idb } from '../../shared/lib/idb.ts';
import type { SecretRecord } from '../recovery/secretLedger.ts';

// Local persistence for the "Your secrets" distribution ledger. Encrypted
// at rest with the wallet passphrase via tapit-attest's encrypt/decrypt
// (PBKDF2-AES) — same posture walletStore / messagesStore / mediaStore use.
// A decrypt failure (wrong passphrase, corrupt blob, version skew) returns
// an empty list rather than throwing, so a boot-race resolves to "no
// records yet" instead of crashing.
//
// METADATA ONLY. These records carry the secret's name, why-note, M-of-N,
// and who-holds-which-piece — never the secret value and never the share
// tokens. See secretLedger.ts for the prime-directive note.

const KEY = (ownerId: string) => `secrets-ledger:${ownerId}`;

function encodeRecords(records: readonly SecretRecord[]): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(records));
}

function decodeRecords(bytes: Uint8Array): SecretRecord[] {
  const text = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(text) as unknown;
  return Array.isArray(parsed) ? (parsed as SecretRecord[]) : [];
}

export const secretsLedgerStore = {
  async load(ownerId: string, passphrase: string): Promise<SecretRecord[]> {
    const blob = await idb.get<EncryptedBlob>(KEY(ownerId));
    if (!blob) return [];
    try {
      return decodeRecords(decrypt(blob, passphrase));
    } catch (err) {
      console.warn('secretsLedgerStore.load decrypt failed — returning empty', err);
      return [];
    }
  },

  async save(
    ownerId: string,
    passphrase: string,
    records: readonly SecretRecord[],
  ): Promise<void> {
    const blob = encrypt(encodeRecords(records), passphrase);
    await idb.put(KEY(ownerId), blob);
  },

  async clear(ownerId: string): Promise<void> {
    await idb.delete(KEY(ownerId));
  },
};
