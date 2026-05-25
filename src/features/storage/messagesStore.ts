import { idb } from '../../shared/lib/idb.ts';
import type { ThreadMessage } from '../messaging/threadMessage.ts';

// Local chat-thread persistence — sub-cut 2b had chat history live
// only in WalletProvider state, which meant the operator's own sent
// messages vanished on reload (the relay subscription filters for
// events addressed to this wallet, so outbound messages were never
// re-delivered). This module gives the in-memory map an IDB-backed
// home so a page reload, a Mycelium toggle, or a wallet lock cycle
// no longer loses the operator's words.
//
// Local-only, keyed by ownerId. Plaintext at rest — the next polish
// cut should encrypt with the wallet passphrase the same way the
// wallet snapshot and media store do (both use tapit-attest's
// encrypt/decrypt over PBKDF2-AES). Plaintext is acceptable as a
// first step because (a) it matches prefsStore's posture, (b) the
// IDB blob is same-origin and cannot leave the device through any
// path the wallet itself doesn't open, and (c) the alternative —
// gating the load on the passphrase being present — would have
// blocked the bug fix the operator is waiting on. The encrypt-at-
// rest follow-on is named in the messaging manifest.
//
// Cloud sync of chat history is explicitly NOT in this module — Cut
// 4 of the per-peer chat surface brief calls for an opt-in cloud
// backup toggle in Settings with the default OFF, and that lives
// in a future cut, not here.

const KEY = (ownerId: string) => `chat-threads:${ownerId}`;

// Serialised shape on disk: one record per ownerId carrying every
// per-peer thread as a plain object. Read back into a Map for the
// in-memory consumer.
type SerialisedThreads = Record<string, ThreadMessage[]>;

export const messagesStore = {
  async load(ownerId: string): Promise<Map<string, ThreadMessage[]>> {
    const data = await idb.get<SerialisedThreads>(KEY(ownerId));
    if (!data || typeof data !== 'object') return new Map();
    const out = new Map<string, ThreadMessage[]>();
    for (const [peer, msgs] of Object.entries(data)) {
      if (Array.isArray(msgs)) out.set(peer, msgs);
    }
    return out;
  },

  async save(
    ownerId: string,
    threads: ReadonlyMap<string, readonly ThreadMessage[]>,
  ): Promise<void> {
    const obj: SerialisedThreads = {};
    for (const [peer, msgs] of threads.entries()) {
      obj[peer] = [...msgs];
    }
    await idb.put(KEY(ownerId), obj);
  },

  async clear(ownerId: string): Promise<void> {
    await idb.delete(KEY(ownerId));
  },
};
