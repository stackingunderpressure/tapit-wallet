import type { Wallet } from 'tapit-attest';
import { verifyEvent, type TransportEvent } from '../transport/nostrEvent.ts';
import type { Subscription, Transport, TransportEventHandler } from '../transport/transport.ts';

// The receive half of the phone-callback phrase-pair delivery (DynastyTrust
// repo, the phone-callback follow-up to docs/2026-08-callback-verification-
// and-amount-tiers.md). A vault owner picks ONE shared normal phrase and ONE
// shared duress phrase for their whole Tapit Circle and sends both, once,
// NIP-44 encrypted, to each circle member's real pubkey -- the same handoff
// shape psbtCosignChannel.ts (kind 9576) and the liveness channel (kind
// 9575) already use. This is the next free sibling kind.
//
// This module ONLY moves ciphertext off the wire and hands the decrypted
// plaintext to the caller. It never stores anything itself -- storing (as a
// salted PBKDF2 hash, never plaintext) is circlePhrase.ts's job, called by
// the hook below immediately on receipt so the plaintext never lingers.
export const CIRCLE_PHRASE_DELIVERY_KIND = 9577;

export interface CirclePhraseDelivery {
  v: 1;
  vault_descriptor: string;
  vault_name: string;
  normal_phrase: string;
  duress_phrase: string;
}

export interface InboxCirclePhraseDelivery {
  delivery: CirclePhraseDelivery;
  senderPubkey: string;
  receivedAt: number;
  eventId: string;
}

export type CirclePhraseDeliveryHandler = (item: InboxCirclePhraseDelivery) => void;

/**
 * Subscribe to circle-phrase deliveries addressed to the wallet's pubkey.
 * Same verify-then-decrypt-then-parse discipline as subscribePsbtCosignRequests:
 * every event is verified before decrypt, and a tampered, mis-routed, or
 * malformed event is silently dropped.
 */
export function subscribeCirclePhraseDeliveries(
  transport: Transport,
  recipient: Wallet,
  onDelivery: CirclePhraseDeliveryHandler,
  options: { since?: number } = {},
): Subscription {
  const handler: TransportEventHandler = (event) => {
    void handleIncoming(event, recipient, onDelivery);
  };
  return transport.subscribe(
    {
      kinds: [CIRCLE_PHRASE_DELIVERY_KIND],
      '#p': recipient.keyHistory,
      ...(options.since !== undefined ? { since: options.since } : {}),
    },
    handler,
  );
}

function isCirclePhraseDelivery(v: unknown): v is CirclePhraseDelivery {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    r.v === 1 &&
    typeof r.vault_descriptor === 'string' &&
    r.vault_descriptor.length > 0 &&
    typeof r.vault_name === 'string' &&
    typeof r.normal_phrase === 'string' &&
    r.normal_phrase.length > 0 &&
    typeof r.duress_phrase === 'string' &&
    r.duress_phrase.length > 0
  );
}

async function handleIncoming(
  event: TransportEvent,
  recipient: Wallet,
  onDelivery: CirclePhraseDeliveryHandler,
): Promise<void> {
  if (!(await verifyEvent(event))) return;
  let plaintext: string;
  try {
    plaintext = recipient.nip44DecryptFromAnyKey(event.content, event.pubkey);
  } catch {
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    return;
  }
  if (!isCirclePhraseDelivery(parsed)) return;
  onDelivery({
    delivery: parsed,
    senderPubkey: event.pubkey,
    receivedAt: event.created_at,
    eventId: event.id,
  });
}
