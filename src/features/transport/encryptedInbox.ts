import type { Attestation, Wallet } from 'tapit-attest';
import { parseEnvelope } from '../cosigning/parseEnvelope.ts';
import {
  TAPIT_CHAT_KIND,
  TAPIT_ENVELOPE_KIND,
  buildEvent,
  verifyEvent,
  type TransportEvent,
} from './nostrEvent.ts';
import type {
  PublishResult,
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
//
// Both halves take a Wallet (D-03) — the private key never crosses
// this module's boundary; the Wallet performs the encryption and
// signing internally.

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
export interface SendResult {
  event: TransportEvent;
  publish: PublishResult;
}

export async function sendEnvelopeTo(
  transport: Transport,
  envelope: Attestation,
  recipientPubkey: string,
  sender: Wallet,
  options: SendOptions = {},
): Promise<SendResult> {
  const plaintext = JSON.stringify(envelope);
  const ciphertext = sender.nip44EncryptTo(plaintext, recipientPubkey);
  const event = await buildEvent({
    pubkey: sender.publicKey,
    sign: (digest) => sender.signDigest(digest),
    kind: TAPIT_ENVELOPE_KIND,
    content: ciphertext,
    tags: [['p', recipientPubkey]],
    created_at: options.created_at,
  });
  const publish = await transport.publish(event);
  return { event, publish };
}

/**
 * Self-CC — publish an envelope encrypted to this wallet's own pubkey
 * so other devices running the same wallet catch it through their
 * live inbox subscription. NIP-44 encrypt-to-self is mathematically
 * well-defined: the ECDH between (own privkey, own pubkey) yields a
 * deterministic shared secret that any device holding the same key
 * can recover. The other device's subscribeInbox sees senderPubkey ==
 * recipientPubkey == own identity and the inbox handler auto-holds
 * instead of routing to UI.
 */
export async function sendEnvelopeToSelf(
  transport: Transport,
  envelope: Attestation,
  wallet: Wallet,
  options: SendOptions = {},
): Promise<SendResult> {
  return sendEnvelopeTo(transport, envelope, wallet.publicKey, wallet, options);
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
 * the wallet's private key (via the wallet); only well-formed,
 * MAC-valid messages reach the handler. A tampered, mis-routed, or
 * junk event is silently dropped — exactly what the wallet wants
 * from a hostile relay.
 *
 * The optional `since` filter (Unix seconds) is forwarded to the
 * transport so a wallet coming online can ask only for events newer
 * than its last sync — Phase 5c-iii will wire that up.
 */
export function subscribeInbox(
  transport: Transport,
  recipient: Wallet,
  onEnvelope: InboxHandler,
  options: { since?: number } = {},
): Subscription {
  const handler: TransportEventHandler = (event) => {
    void handleIncoming(event, recipient, onEnvelope);
  };
  return transport.subscribe(
    {
      kinds: [TAPIT_ENVELOPE_KIND],
      '#p': [recipient.publicKey],
      ...(options.since !== undefined ? { since: options.since } : {}),
    },
    handler,
  );
}

async function handleIncoming(
  event: TransportEvent,
  recipient: Wallet,
  onEnvelope: InboxHandler,
): Promise<void> {
  if (!(await verifyEvent(event))) return;
  let plaintext: string;
  try {
    plaintext = recipient.nip44DecryptFrom(event.content, event.pubkey);
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
}

// ─── Cut 1 — TAPIT_CHAT_KIND ──────────────────────────────────────
// A chat message is the casual, non-attestation sibling of an
// envelope: same Schnorr signature, same NIP-44 v2 encrypted wrap,
// same recipient-addressed `p` tag, but the plaintext carries a
// ChatPayload JSON object rather than a serialized Attestation. The
// wire crypto is identical to the envelope path — the "lightness" is
// purely that no attestation kind is invoked and no anchoring is
// implied. Promotion to a full envelope happens at the UI layer.

/**
 * Payload format for TAPIT_CHAT_KIND events. JSON-shaped from the
 * start so future fields (attachments, replyTo, etc.) are additive
 * without a wire-format change. Cut 1 ships text-only; later cuts
 * add the optional fields.
 */
export interface ChatPayload {
  /** UTF-8 message body. Empty string allowed for attachment-only messages later. */
  text: string;
}

export interface SendChatResult {
  event: TransportEvent;
  publish: PublishResult;
}

/**
 * Encrypt a ChatPayload to the recipient's x-only pubkey and publish
 * the resulting Nostr event under TAPIT_CHAT_KIND. The payload is
 * serialized as canonical JSON before encryption — the recipient
 * recovers it with JSON.parse + the defensive shape check in
 * handleIncomingChat. Returns the wire event + publish result.
 */
export async function sendChatMessageTo(
  transport: Transport,
  payload: ChatPayload,
  recipientPubkey: string,
  sender: Wallet,
  options: SendOptions = {},
): Promise<SendChatResult> {
  const plaintext = JSON.stringify(payload);
  const ciphertext = sender.nip44EncryptTo(plaintext, recipientPubkey);
  const event = await buildEvent({
    pubkey: sender.publicKey,
    sign: (digest) => sender.signDigest(digest),
    kind: TAPIT_CHAT_KIND,
    content: ciphertext,
    tags: [['p', recipientPubkey]],
    created_at: options.created_at,
  });
  const publish = await transport.publish(event);
  return { event, publish };
}

export interface InboxChatMessage {
  payload: ChatPayload;
  senderPubkey: string;
  receivedAt: number;
  eventId: string;
}

export type ChatMessageHandler = (item: InboxChatMessage) => void;

/**
 * Subscribe to encrypted chat messages addressed to the wallet's
 * pubkey. Mirrors subscribeInbox in shape — verify, decrypt, parse,
 * silently drop anything malformed — but filters for TAPIT_CHAT_KIND
 * and yields ChatPayload objects rather than Attestations. The
 * envelope subscription and the chat subscription are independent;
 * a wallet that wants both opens both.
 */
export function subscribeChatMessages(
  transport: Transport,
  recipient: Wallet,
  onMessage: ChatMessageHandler,
  options: { since?: number } = {},
): Subscription {
  const handler: TransportEventHandler = (event) => {
    void handleIncomingChat(event, recipient, onMessage);
  };
  return transport.subscribe(
    {
      kinds: [TAPIT_CHAT_KIND],
      '#p': [recipient.publicKey],
      ...(options.since !== undefined ? { since: options.since } : {}),
    },
    handler,
  );
}

async function handleIncomingChat(
  event: TransportEvent,
  recipient: Wallet,
  onMessage: ChatMessageHandler,
): Promise<void> {
  if (!(await verifyEvent(event))) return;
  let plaintext: string;
  try {
    plaintext = recipient.nip44DecryptFrom(event.content, event.pubkey);
  } catch {
    return;
  }
  const payload = parseChatPayload(plaintext);
  if (!payload) return;
  onMessage({
    payload,
    senderPubkey: event.pubkey,
    receivedAt: event.created_at,
    eventId: event.id,
  });
}

function parseChatPayload(plaintext: string): ChatPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.text !== 'string') return null;
  return { text: obj.text };
}
