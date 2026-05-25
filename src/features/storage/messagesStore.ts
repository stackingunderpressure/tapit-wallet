import { encrypt, decrypt, type EncryptedBlob } from 'tapit-attest';
import { idb } from '../../shared/lib/idb.ts';
import type { ThreadMessage } from '../messaging/threadMessage.ts';

// Local chat-thread persistence. Encrypted at rest with the wallet
// passphrase via tapit-attest's encrypt/decrypt (PBKDF2-AES) — same
// posture walletStore and mediaStore already use. The IndexedDB
// blob is ciphertext only; a decrypt failure (wrong passphrase,
// corrupt blob, version skew) returns an empty thread map rather
// than throwing, so a missing-passphrase race during boot resolves
// to "no history yet" instead of crashing the unlock surface.
//
// Local-only. Cloud-sync of chat history is explicitly NOT in this
// module — Cut 4 of the per-peer chat surface brief calls for an
// opt-in cloud-backup toggle in Settings (default OFF), and that
// lives in a future cut, not here.

const KEY = (ownerId: string) => `chat-threads:${ownerId}`;

type SerialisedThreads = Record<string, ThreadMessage[]>;

function encodeThreads(
  threads: ReadonlyMap<string, readonly ThreadMessage[]>,
): Uint8Array {
  const obj: SerialisedThreads = {};
  for (const [peer, msgs] of threads.entries()) {
    obj[peer] = [...msgs];
  }
  return new TextEncoder().encode(JSON.stringify(obj));
}

function decodeThreads(bytes: Uint8Array): Map<string, ThreadMessage[]> {
  const text = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(text) as SerialisedThreads;
  const out = new Map<string, ThreadMessage[]>();
  if (parsed && typeof parsed === 'object') {
    for (const [peer, msgs] of Object.entries(parsed)) {
      if (Array.isArray(msgs)) out.set(peer, msgs);
    }
  }
  return out;
}

export const messagesStore = {
  async load(
    ownerId: string,
    passphrase: string,
  ): Promise<Map<string, ThreadMessage[]>> {
    const blob = await idb.get<EncryptedBlob>(KEY(ownerId));
    if (!blob) return new Map();
    try {
      const bytes = decrypt(blob, passphrase);
      return decodeThreads(bytes);
    } catch (err) {
      console.warn('messagesStore.load decrypt failed — returning empty', err);
      return new Map();
    }
  },

  async save(
    ownerId: string,
    passphrase: string,
    threads: ReadonlyMap<string, readonly ThreadMessage[]>,
  ): Promise<void> {
    const bytes = encodeThreads(threads);
    const blob = encrypt(bytes, passphrase);
    await idb.put(KEY(ownerId), blob);
  },

  async clear(ownerId: string): Promise<void> {
    await idb.delete(KEY(ownerId));
  },
};
