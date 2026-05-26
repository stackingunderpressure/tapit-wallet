import type { Wallet } from 'tapit-attest';
import {
  encryptTo,
  generateKeypair,
  signDigest as schnorrSignDigest,
} from 'tapit-attest';
import {
  buildEvent,
  verifyEvent,
  type Tag,
  type TransportEvent,
} from './nostrEvent.ts';

// NIP-17 gift-wrapped private direct messages — the Nostr-standard
// shape for end-to-end-encrypted chat. Three nested layers:
//
//   1. Rumor (kind 14) — the actual message. NEVER signed and NEVER
//      published directly. Encoded as a plain JSON object with the
//      sender's real pubkey, real timestamp, recipient pubkey(s) in
//      'p' tags, and the message text as content.
//
//   2. Seal (kind 13) — NIP-44-encrypts the rumor JSON to the
//      recipient using the SENDER's real key. Signed by the sender.
//      Carries the real sender pubkey but a randomized created_at
//      (within the past two days) so the relay cannot correlate
//      send time with arrival time.
//
//   3. Gift wrap (kind 1059) — NIP-44-encrypts the seal JSON to the
//      recipient using an EPHEMERAL key generated per-message and
//      discarded. Signed by the ephemeral key. The relay sees only
//      this outer wrap; the sender's real pubkey never appears at
//      the wire level. Randomized created_at, same hiding rationale.
//
// Why this layered shape: the relay sees a kind-1059 event from a
// random ephemeral pubkey to a known recipient pubkey, with
// encrypted content. It cannot tell who the real sender is, what
// the message says, or when it was actually sent. The recipient
// peels off the gift wrap with their real key to see the seal,
// peels off the seal with their real key to see the rumor, then
// verifies the rumor's claimed sender against the seal's signed
// pubkey to detect impersonation.
//
// Why this kind instead of the previous custom kind 9574: kind
// 1059 is Nostr-standard and supported by every modern relay's
// storage policy, which solves the operator-reported chat-not-
// delivering bug where public relays would accept publishes of the
// custom kind but not retain them for offline delivery. The
// privacy upgrade — relay-level sender anonymity — is a side
// benefit of the same migration.

/** NIP-17 kind 14 — the rumor. Unsigned, never published; carried
 *  inside a seal which is carried inside a gift wrap. */
export const NIP17_CHAT_RUMOR_KIND = 14;

/** NIP-17 kind 13 — the seal. Signed by the real sender; encrypted
 *  with the sender's real key to the recipient. */
export const NIP17_SEAL_KIND = 13;

/** NIP-17 kind 1059 — the gift wrap. Signed by an ephemeral key;
 *  encrypted with that ephemeral key to the recipient. The only
 *  event published to relays. */
export const NIP17_GIFT_WRAP_KIND = 1059;

// NIP-17 spec: randomize created_at within the past two days to
// leak less timing information. Math.random is fine here — this
// is a privacy hint, not a cryptographic randomness requirement;
// every additional hour of jitter weakens relay-side traffic
// analysis without changing the security model.
const TWO_DAYS_SEC = 60 * 60 * 24 * 2;
function randomizedPastTimestamp(): number {
  const now = Math.floor(Date.now() / 1000);
  return now - Math.floor(Math.random() * TWO_DAYS_SEC);
}

/** Plain JSON shape for the kind-14 rumor. Cut 1 ships text-only;
 *  later cuts may extend with structured payloads (attachments,
 *  replyTo, etc.) by carrying JSON inside `content`. */
export interface ChatRumor {
  /** Real sender pubkey (the wallet's identity). */
  pubkey: string;
  /** Real send timestamp — not randomized. */
  created_at: number;
  /** Always kind 14. */
  kind: typeof NIP17_CHAT_RUMOR_KIND;
  /** Recipient(s) named via 'p' tags. The unwrap path requires the
   *  unwrapping wallet's pubkey to appear here so a relay-injected
   *  gift wrap addressed to someone the rumor doesn't name gets
   *  dropped. */
  tags: readonly Tag[];
  /** UTF-8 message body. */
  content: string;
}

/**
 * Build a kind-1059 gift wrap ready to publish via the transport.
 * The wrap carries an encrypted seal which itself carries the
 * encrypted rumor. The sender's real pubkey never appears at the
 * relay; only the ephemeral wrapper pubkey does.
 *
 * Caller responsibility: pass a Wallet that owns the real sender
 * key (the wallet handles the seal-side encryption + signing
 * internally without exposing the privkey). The ephemeral keypair
 * is generated inside this function and immediately discarded after
 * one use.
 */
export async function buildGiftWrap(
  rumor: ChatRumor,
  recipientPubkey: string,
  sender: Wallet,
): Promise<TransportEvent> {
  // Seal: encrypt rumor JSON to recipient with the SENDER's real
  // key. Sign the seal with the sender's real key. Randomized
  // created_at hides true send time from the relay.
  const sealPlaintext = JSON.stringify(rumor);
  const sealContent = sender.nip44EncryptTo(sealPlaintext, recipientPubkey);
  const seal = await buildEvent({
    pubkey: sender.publicKey,
    sign: (digest) => sender.signDigest(digest),
    kind: NIP17_SEAL_KIND,
    content: sealContent,
    tags: [],
    created_at: randomizedPastTimestamp(),
  });
  // Gift wrap: encrypt seal JSON to recipient with a FRESH ephemeral
  // key generated per-message. Sign the wrap with the ephemeral
  // privkey. The ephemeral key is referenced nowhere else — it
  // falls out of scope at function return and is unrecoverable.
  const ephemeral = generateKeypair();
  const wrapContent = encryptTo(
    JSON.stringify(seal),
    recipientPubkey,
    ephemeral.privateKey,
  );
  return buildEvent({
    pubkey: ephemeral.publicKey,
    sign: (digest) => schnorrSignDigest(digest, ephemeral.privateKey),
    kind: NIP17_GIFT_WRAP_KIND,
    content: wrapContent,
    tags: [['p', recipientPubkey]],
    created_at: randomizedPastTimestamp(),
  });
}

export interface UnwrappedChat {
  /** Real sender pubkey, recovered from the seal's signed pubkey field. */
  senderPubkey: string;
  /** Real send timestamp from the rumor (not randomized). */
  sentAt: number;
  /** Message body. */
  text: string;
}

/**
 * Verify, decrypt, and unwrap a kind-1059 gift wrap addressed to
 * `recipient`. Returns null on every failure path — bad ephemeral
 * signature, decrypt failure on the outer wrap, malformed seal,
 * bad seal signature, decrypt failure on the inner rumor, malformed
 * rumor, rumor.pubkey mismatch with seal.pubkey (impersonation), or
 * rumor that doesn't name `recipient` in its p tags (relay-injected
 * mis-routing). The caller drops null results silently the same way
 * subscribeInbox drops malformed events.
 *
 * The recovered senderPubkey is the seal's signed pubkey, NOT the
 * gift wrap's ephemeral pubkey. The seal signature binds the claimed
 * sender to the encrypted rumor; the inner rumor.pubkey === seal.pubkey
 * check rejects an attacker who steals a seal and re-wraps it
 * claiming a different rumor sender.
 */
export async function unwrapGiftWrap(
  giftWrap: TransportEvent,
  recipient: Wallet,
): Promise<UnwrappedChat | null> {
  if (giftWrap.kind !== NIP17_GIFT_WRAP_KIND) return null;
  if (!(await verifyEvent(giftWrap))) return null;
  let sealJson: string;
  try {
    sealJson = recipient.nip44DecryptFrom(giftWrap.content, giftWrap.pubkey);
  } catch {
    return null;
  }
  let sealParsed: unknown;
  try {
    sealParsed = JSON.parse(sealJson);
  } catch {
    return null;
  }
  const seal = narrowToTransportEvent(sealParsed);
  if (!seal) return null;
  if (seal.kind !== NIP17_SEAL_KIND) return null;
  if (!(await verifyEvent(seal))) return null;
  let rumorJson: string;
  try {
    rumorJson = recipient.nip44DecryptFrom(seal.content, seal.pubkey);
  } catch {
    return null;
  }
  let rumorParsed: unknown;
  try {
    rumorParsed = JSON.parse(rumorJson);
  } catch {
    return null;
  }
  if (!rumorParsed || typeof rumorParsed !== 'object') return null;
  const r = rumorParsed as Record<string, unknown>;
  if (r.kind !== NIP17_CHAT_RUMOR_KIND) return null;
  if (typeof r.pubkey !== 'string') return null;
  if (r.pubkey !== seal.pubkey) return null;
  if (typeof r.content !== 'string') return null;
  if (typeof r.created_at !== 'number' || !Number.isFinite(r.created_at)) return null;
  if (!Array.isArray(r.tags)) return null;
  let recipientNamed = false;
  for (const t of r.tags) {
    if (!Array.isArray(t)) continue;
    if (t[0] === 'p' && t[1] === recipient.publicKey) {
      recipientNamed = true;
      break;
    }
  }
  if (!recipientNamed) return null;
  return {
    senderPubkey: seal.pubkey,
    sentAt: r.created_at,
    text: r.content,
  };
}

function narrowToTransportEvent(raw: unknown): TransportEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (
    typeof o.id !== 'string' ||
    typeof o.pubkey !== 'string' ||
    typeof o.sig !== 'string' ||
    typeof o.content !== 'string' ||
    typeof o.kind !== 'number' ||
    typeof o.created_at !== 'number' ||
    !Array.isArray(o.tags)
  ) {
    return null;
  }
  return {
    id: o.id,
    pubkey: o.pubkey,
    sig: o.sig,
    content: o.content,
    kind: o.kind,
    created_at: o.created_at,
    tags: o.tags as readonly Tag[],
  };
}
