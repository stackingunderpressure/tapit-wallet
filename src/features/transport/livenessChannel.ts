import type { Wallet } from 'tapit-attest';
import {
  verifyProofOfLife,
  verifyDuressFlag,
  type ProofOfLife,
  type DuressFlag,
} from 'tapit-attest';
import { buildEvent, verifyEvent, type TransportEvent } from './nostrEvent.ts';
import type {
  PublishResult,
  Subscription,
  Transport,
  TransportEventHandler,
} from './transport.ts';

// Dedicated encrypted liveness channel — Path B from
// src/features/liveness/liveness.ts. Liveness signals (ProofOfLife,
// DuressFlag) are NOT Attestation envelopes, so they must NOT ride the
// encrypted inbox (sendEnvelopeTo / subscribeInbox), whose receive half
// runs parseEnvelope -> assertWellFormed and would reject a liveness
// signal outright. Forcing a signal to masquerade as an Attestation
// would distort the one-envelope standard; that is forbidden by
// doctrine.
//
// The clean ride exists one layer BELOW the inbox: the same primitives
// the encrypted inbox is itself built from — buildEvent +
// wallet.nip44EncryptTo + transport.publish/subscribe. Liveness gets
// its OWN wire kind, a sibling to TAPIT_ENVELOPE_KIND (9573), exactly
// as NIP-17 chat rides its own kind 1059 rather than the envelope kind.
//
// RAILS:
//  - Relays only ever see ciphertext. The signal JSON is NIP-44 v2
//    encrypted to the recipient before publish, exactly like the inbox.
//  - The INNER liveness signature is verified on receive with the
//    liveness verifiers (verifyProofOfLife / verifyDuressFlag), NOT
//    parseEnvelope. A relay or a stranger therefore cannot inject a
//    fake heartbeat or red flag — a forged inner signal never reaches
//    the handler.
//  - The private key never crosses this module's boundary. The Wallet
//    performs the encryption (nip44EncryptTo / nip44DecryptFromAnyKey)
//    and the outer event signing (signDigest) internally; the inner
//    liveness signature was already minted by the liveness store.
//  - Every failure path drops silently — bad outer sig, bad decrypt,
//    malformed JSON, bad inner verify, duplicate event id. Nothing is
//    ever thrown to the receive handler; a hostile relay gets the same
//    treatment as the inbox gives it.

/**
 * Custom event kind for an encrypted liveness signal. Sits in the
 * regular-event range (1000–9999) so relays persist it for async
 * delivery, a sibling to TAPIT_ENVELOPE_KIND = 9573. We deliberately do
 * NOT reuse 9573 (the Attestation envelope kind) or 1059 (NIP-17 chat
 * gift wrap): a distinct kind lets a wallet subscribe to liveness
 * independently of its envelope inbox and keeps the one-envelope
 * standard untouched. 9574 was the now-retired custom chat kind, so the
 * next free sibling is 9575.
 */
export const TAPIT_LIVENESS_KIND = 9575;

/**
 * The wire shape that travels (encrypted) on the liveness channel — the
 * exact wrapper the liveness store uses (see LivenessSignal in
 * src/features/liveness/liveness.ts). Re-declared here rather than
 * imported so the transport module does not depend on the feature
 * module (the dependency points the other way: the feature wires this
 * in). The shapes must stay in lockstep.
 */
export type LivenessSignal =
  | { kind: 'proof-of-life'; signal: ProofOfLife }
  | { kind: 'duress-flag'; signal: DuressFlag };

export interface SendLivenessOptions {
  /** Override the timestamp — tests use a fixed value for determinism. */
  created_at?: number;
}

export interface SendLivenessResult {
  event: TransportEvent;
  publish: PublishResult;
}

/**
 * Encrypt a liveness signal to the recipient's x-only pubkey and
 * publish it through the transport on the dedicated liveness kind. The
 * signal wrapper is serialized as canonical JSON before encryption; the
 * recipient recovers it in subscribeLiveness and re-verifies the inner
 * signature with the liveness verifiers. Returns the same shape
 * sendEnvelopeTo returns.
 *
 * The inner liveness signature (on the ProofOfLife / DuressFlag) was
 * already minted by the liveness store through wallet.signDigest; this
 * function never sees a raw private key. The Wallet does the NIP-44
 * encryption and the outer event signing internally.
 */
export async function sendLivenessSignal(
  transport: Transport,
  signal: LivenessSignal,
  recipientPubkey: string,
  sender: Wallet,
  options: SendLivenessOptions = {},
): Promise<SendLivenessResult> {
  const plaintext = JSON.stringify(signal);
  const ciphertext = sender.nip44EncryptTo(plaintext, recipientPubkey);
  const event = await buildEvent({
    pubkey: sender.publicKey,
    sign: (digest) => sender.signDigest(digest),
    kind: TAPIT_LIVENESS_KIND,
    content: ciphertext,
    tags: [['p', recipientPubkey]],
    created_at: options.created_at,
  });
  const publish = await transport.publish(event);
  return { event, publish };
}

export interface IncomingLivenessSignal {
  signal: LivenessSignal['signal'];
  kind: LivenessSignal['kind'];
  senderPubkey: string;
  eventId: string;
  receivedAt: number;
}

export type LivenessSignalHandler = (item: IncomingLivenessSignal) => void;

/**
 * Subscribe to encrypted liveness signals addressed to the wallet's
 * pubkey on the dedicated liveness kind. Each event is verified
 * (signature + id match), decrypted with the wallet's private key (via
 * the Wallet), JSON-parsed, and — critically — the INNER liveness
 * signature is re-verified with verifyProofOfLife / verifyDuressFlag.
 * Only a well-formed, MAC-valid, inner-signature-valid, non-duplicate
 * signal reaches the handler. Every failure path drops silently — bad
 * outer sig, bad decrypt, junk JSON, bad inner verify, or a repeated
 * event id — exactly what the wallet wants from a hostile relay.
 *
 * The optional `since` filter (Unix seconds) is forwarded to the
 * transport so a wallet coming online can ask only for events newer
 * than its last sync.
 */
export function subscribeLiveness(
  transport: Transport,
  recipient: Wallet,
  onSignal: LivenessSignalHandler,
  options: { since?: number } = {},
): Subscription {
  // Dedup by event id, mirroring the chat/inbox expectation that the
  // same event arriving on multiple relays delivers to the handler
  // once. The Transport contract already dedupes across relays, but we
  // guard here too so a re-published duplicate never double-folds into
  // the liveness store.
  const seen = new Set<string>();
  const handler: TransportEventHandler = (event) => {
    void handleIncoming(event, recipient, onSignal, seen);
  };
  return transport.subscribe(
    {
      kinds: [TAPIT_LIVENESS_KIND],
      // Subscribe on every key this wallet has ever used (genesis +
      // each rotated key), not just the active one — same reasoning as
      // subscribeInbox. A peer who connected before a rotation still
      // addresses signals to a retired key.
      '#p': recipient.keyHistory,
      ...(options.since !== undefined ? { since: options.since } : {}),
    },
    handler,
  );
}

async function handleIncoming(
  event: TransportEvent,
  recipient: Wallet,
  onSignal: LivenessSignalHandler,
  seen: Set<string>,
): Promise<void> {
  if (seen.has(event.id)) return;
  if (!(await verifyEvent(event))) return;
  let plaintext: string;
  try {
    // AnyKey: signals a peer addressed to a pre-rotation key must still
    // decrypt — the subscribe filter already accepts every key in
    // keyHistory, and this is the matching decrypt half.
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
  const wrapper = narrowToLivenessSignal(parsed);
  if (!wrapper) return;
  // Verify the INNER liveness signature with the liveness verifiers,
  // NOT parseEnvelope. A forged heartbeat or red flag is dropped here
  // and never reaches the handler.
  if (wrapper.kind === 'proof-of-life') {
    if (!verifyProofOfLife(wrapper.signal)) return;
  } else {
    if (!verifyDuressFlag(wrapper.signal)) return;
  }
  // Record the id only once the event has fully passed; a dropped junk
  // event should not poison a later legitimate one sharing the id
  // (ids are content-bound so this is belt-and-suspenders).
  seen.add(event.id);
  onSignal({
    signal: wrapper.signal,
    kind: wrapper.kind,
    senderPubkey: event.pubkey,
    eventId: event.id,
    receivedAt: event.created_at,
  });
}

/**
 * Narrow an unknown parsed payload to a LivenessSignal wrapper. Returns
 * null on any shape mismatch; the full cryptographic verification of
 * the inner signal happens in the caller via the liveness verifiers.
 * This is only a structural gate so the verifiers receive the right
 * shape.
 */
function narrowToLivenessSignal(raw: unknown): LivenessSignal | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.kind === 'proof-of-life') {
    if (!o.signal || typeof o.signal !== 'object') return null;
    return { kind: 'proof-of-life', signal: o.signal as ProofOfLife };
  }
  if (o.kind === 'duress-flag') {
    if (!o.signal || typeof o.signal !== 'object') return null;
    return { kind: 'duress-flag', signal: o.signal as DuressFlag };
  }
  return null;
}
