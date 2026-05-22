import { encryptTo, decryptFrom } from 'tapit-attest';
import type { Attestation } from 'tapit-attest';
import { parseEnvelope } from '../cosigning/parseEnvelope.ts';
import {
  TAPIT_ENVELOPE_KIND,
  buildEvent,
  verifyEvent,
  type TransportEvent,
} from './nostrEvent.ts';
import type {
  Subscription,
  Transport,
  TransportEventHandler,
} from './transport.ts';

// Encrypted inbox — the only API the rest of the wallet should use
// for peer messaging. Wraps a tapit-attest envelope in NIP-44 v2
// ciphertext addressed to one recipient, publishes through the
// Transport, and on the receive side decrypts and re-parses.
//
// Relays only ever see ciphertext (D-11, MYCELIUM_NETWORK_SPEC §9).
// The recipient is named in a 'p' tag so the relay can filter by
// addressee; the sender is the event's pubkey by Nostr construction.
//
// Per D-11c, every Tapit envelope rides inside event kind
// TAPIT_ENVELOPE_KIND — NIP-46 stays reserved for the separate
// app-to-wallet sign pathway.

export interface SendOptions {
  /** Override the timestamp — tests use a fixed value for determinism. */
  created_at?: number;
}

/**
 * Encrypt the envelope to the recipient's x-only pubkey and publish
 * the resulting Nostr event through the transport. The envelope is
 * serialized as canonical JSON before encryption — the recipient
 * recovers it with parseEnvelope.
 */
export async function sendEnvelopeTo(
  transport: Transport,
  envelope: Attestation,
  recipientPubkey: string,
  senderPubkey: string,
  senderPrivkey: string,
  options: SendOptions = {},
): Promise<TransportEvent> {
  const plaintext = JSON.stringify(envelope);
  const ciphertext = encryptTo(plaintext, recipientPubkey, senderPrivkey);
  const event = await buildEvent({
    pubkey: senderPubkey,
    privkey: senderPrivkey,
    kind: TAPIT_ENVELOPE_KIND,
    content: ciphertext,
    tags: [['p', recipientPubkey]],
    created_at: options.created_at,
  });
  await transport.publish(event);
  return event;
}

export interface InboxEnvelope {
  envelope: Attestation;
  senderPubkey: string;
  receivedAt: number;
  eventId: string;
}

export type InboxHandler = (item: InboxEnvelope) => void;

/**
 * Subscribe to encrypted envelopes addressed to the wallet's pubkey.
 * Each event is verified (signature + id match) and decrypted with
 * the recipient's private key; only well-formed, MAC-valid messages
 * reach the handler. A tampered, mis-routed, or junk event is
 * silently dropped — exactly what the wallet wants from a hostile
 * relay.
 *
 * The optional `since` filter (Unix seconds) is forwarded to the
 * transport so a wallet coming online can ask only for events newer
 * than its last sync — Phase 5c-iii will wire that up.
 */
export function subscribeInbox(
  transport: Transport,
  recipientPubkey: string,
  recipientPrivkey: string,
  onEnvelope: InboxHandler,
  options: { since?: number } = {},
): Subscription {
  const handler: TransportEventHandler = (event) => {
    void handleIncoming(event, recipientPubkey, recipientPrivkey, onEnvelope);
  };
  return transport.subscribe(
    {
      kinds: [TAPIT_ENVELOPE_KIND],
      '#p': [recipientPubkey],
      ...(options.since !== undefined ? { since: options.since } : {}),
    },
    handler,
  );
}

async function handleIncoming(
  event: TransportEvent,
  recipientPubkey: string,
  recipientPrivkey: string,
  onEnvelope: InboxHandler,
): Promise<void> {
  if (!(await verifyEvent(event))) return;
  let plaintext: string;
  try {
    plaintext = decryptFrom(event.content, event.pubkey, recipientPrivkey);
  } catch {
    return;
  }
  let parsed: Attestation;
  try {
    parsed = parseEnvelope(plaintext);
  } catch {
    return;
  }
  onEnvelope({
    envelope: parsed,
    senderPubkey: event.pubkey,
    receivedAt: event.created_at,
    eventId: event.id,
  });
  // recipientPubkey is preserved in the closure for future filter
  // adjustments (e.g. per-recipient sub multiplexing); not used here.
  void recipientPubkey;
}
