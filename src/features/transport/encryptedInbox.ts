import type { Attestation, Wallet } from 'tapit-attest';
import { parseEnvelope } from '../cosigning/parseEnvelope.ts';
import {
  TAPIT_ENVELOPE_KIND,
  buildEvent,
  verifyEvent,
  type TransportEvent,
} from './nostrEvent.ts';
import {
  buildGiftWrap,
  unwrapGiftWrap,
  NIP17_CHAT_RUMOR_KIND,
  NIP17_GIFT_WRAP_KIND,
  type ChatRumor,
} from './nip17.ts';
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
      // Subscribe on every key this wallet has ever used (genesis +
      // each rotated key), not just the active one — same reasoning as
      // subscribeChatMessages below. A peer who connected before a
      // rotation still addresses envelopes to a retired key. NOTE: the
      // FILTER half is fixed here, but a wallet that has discarded the
      // old PRIVATE key still cannot DECRYPT a message sent to it —
      // that requires retaining the keypair history in the Wallet,
      // tracked as the follow-up to operator bug 2026-05-31.
      '#p': recipient.keyHistory,
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

// ─── NIP-17 gift-wrapped chat ─────────────────────────────────────
// Chat now rides NIP-17 (kind 1059 gift wrap → kind 13 seal → kind
// 14 rumor) instead of the previous custom kind 9574 — see nip17.ts
// for the wire-format details. Rationale: every modern Nostr relay
// stores kind 1059 events for offline retrieval (Nostr-standard
// kind), whereas custom kinds in the 9000s are accepted-but-not-
// persisted by many public relays, which was the root cause of the
// operator-reported "messages are not being received by the other
// person" bug. Privacy bonus: the relay no longer sees the real
// sender's pubkey — only the per-message ephemeral wrapper does.
// The recipient's pubkey is still tagged on the gift wrap so the
// recipient's subscription filter can find their inbox.

/**
 * Plaintext payload exposed to chat callers. Cut 1 ships text-only;
 * future cuts may extend with structured payloads inside the rumor
 * content. Public shape is stable across the kind-9574 → kind-1059
 * migration so the WalletProvider sendChatMessage caller and the
 * PeerThread render layer continue to work unchanged.
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
 * Build a NIP-17 gift-wrapped chat message for the recipient and
 * publish it through the transport. The gift wrap (kind 1059) is
 * what lands on the relay — it carries the sealed rumor inside two
 * NIP-44 encryption layers, signed by an ephemeral key so the
 * sender's real pubkey never appears at the wire level.
 *
 * The optional `options.created_at` is used as the rumor's real
 * timestamp — the seal and gift wrap each randomize their own
 * `created_at` within the past two days per NIP-17 to hide send
 * time from the relay. Tests pin the rumor timestamp for
 * deterministic assertions.
 */
export async function sendChatMessageTo(
  transport: Transport,
  payload: ChatPayload,
  recipientPubkey: string,
  sender: Wallet,
  options: SendOptions = {},
): Promise<SendChatResult> {
  const rumor: ChatRumor = {
    pubkey: sender.publicKey,
    created_at: options.created_at ?? Math.floor(Date.now() / 1000),
    kind: NIP17_CHAT_RUMOR_KIND,
    tags: [['p', recipientPubkey]],
    content: payload.text,
  };
  const giftWrap = await buildGiftWrap(rumor, recipientPubkey, sender);
  const publish = await transport.publish(giftWrap);
  return { event: giftWrap, publish };
}

export interface InboxChatMessage {
  payload: ChatPayload;
  senderPubkey: string;
  receivedAt: number;
  eventId: string;
}

export type ChatMessageHandler = (item: InboxChatMessage) => void;

/**
 * Subscribe to NIP-17 gift-wrapped chat messages addressed to the
 * wallet's pubkey. Mirrors subscribeInbox in shape — every event is
 * verified, decrypted, unwrapped twice, and shape-checked; any
 * failure path silently drops the event. Yields InboxChatMessage
 * objects whose `senderPubkey` is the REAL sender (recovered from
 * the inner seal's signed pubkey field), not the gift wrap's
 * ephemeral pubkey, so chat threads track the right peer.
 *
 * The envelope subscription (kind TAPIT_ENVELOPE_KIND) and the chat
 * subscription (kind NIP17_GIFT_WRAP_KIND) are independent — a
 * wallet that wants both opens both.
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
      kinds: [NIP17_GIFT_WRAP_KIND],
      // Subscribe on EVERY key this wallet has ever used, not just the
      // active one. After a key rotation the active key changes, but
      // peers who connected before the rotation still address their
      // gift-wraps to the wallet's pre-rotation key in the #p tag.
      // Filtering on recipient.publicKey alone silently dropped every
      // message — chat AND envelope deliveries — addressed to a retired
      // key, which is exactly what broke chat after the operator
      // rotated their signing key. keyHistory = [genesis, ...rotated]
      // so messages to any past or current key still match. (Operator
      // bug 2026-05-31: rotated key, chat went silent.)
      '#p': recipient.keyHistory,
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
  const unwrapped = await unwrapGiftWrap(event, recipient);
  if (!unwrapped) return;
  onMessage({
    payload: { text: unwrapped.text },
    senderPubkey: unwrapped.senderPubkey,
    receivedAt: unwrapped.sentAt,
    eventId: event.id,
  });
}
