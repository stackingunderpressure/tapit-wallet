import { encrypt, decrypt, type EncryptedBlob } from 'tapit-attest';
import { idb } from '../../shared/lib/idb.ts';
import type { InboxEnvelope } from '../transport/encryptedInbox.ts';

// Local durability for generic inbox envelope arrivals (family/circle
// attestations, vouch requests, recovery shares, membership records —
// everything InboxPanel routes). Encrypted at rest with the wallet
// passphrase via tapit-attest's encrypt/decrypt, same posture
// messagesStore already uses for chat history.
//
// Before this, inboxEnvelopes lived ONLY in WalletProvider's React
// state, reset to [] on every lock/sign-out/transport-teardown, with
// the documented assumption that "the Nostr relay re-delivers every
// stored event on every wallet unlock" (dismissedInboxStore.ts's own
// comment). Operator, 2026-08-10, after the new Inbox screen showed
// "nothing waiting" everywhere: "Not showing the messages in the inbox
// the past one should show up it should be durable. We should always
// see them till you delete them." A relay's backlog retention is not
// this wallet's to depend on — a public relay can prune old events,
// rotate, or simply not be the one a peer's message landed on for
// this wallet's subscription window. This store makes "delete" (the
// existing dismissedInboxStore) the only thing that removes an
// envelope, not a relay's replay policy.
const KEY = (ownerId: string) => `inbox-envelopes:${ownerId}`;

function encodeEnvelopes(envelopes: readonly InboxEnvelope[]): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(envelopes));
}

function decodeEnvelopes(bytes: Uint8Array): InboxEnvelope[] {
  const parsed = JSON.parse(new TextDecoder().decode(bytes));
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (v): v is InboxEnvelope =>
      !!v &&
      typeof v === 'object' &&
      typeof v.eventId === 'string' &&
      typeof v.senderPubkey === 'string' &&
      typeof v.receivedAt === 'number' &&
      !!v.envelope,
  );
}

export const inboxEnvelopeStore = {
  async load(ownerId: string, passphrase: string): Promise<InboxEnvelope[]> {
    const blob = await idb.get<EncryptedBlob>(KEY(ownerId));
    if (!blob) return [];
    try {
      return decodeEnvelopes(decrypt(blob, passphrase));
    } catch (err) {
      console.warn('inboxEnvelopeStore.load decrypt failed — returning empty', err);
      return [];
    }
  },

  async save(
    ownerId: string,
    passphrase: string,
    envelopes: readonly InboxEnvelope[],
  ): Promise<void> {
    const blob = encrypt(encodeEnvelopes(envelopes), passphrase);
    await idb.put(KEY(ownerId), blob);
  },

  async clear(ownerId: string): Promise<void> {
    await idb.delete(KEY(ownerId));
  },
};
