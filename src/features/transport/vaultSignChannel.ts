import type { Wallet } from 'tapit-attest';
import { buildEvent, verifyEvent, type TransportEvent } from './nostrEvent.ts';
import type {
  PublishResult,
  Subscription,
  Transport,
  TransportEventHandler,
} from './transport.ts';

// Dedicated encrypted vault-sign channel — Cut B stage B3
// (docs/integration-phase1-signin-and-bridge.md, DynastyTrust repo). A
// psbt-cosign SignRequest is NOT an Attestation envelope, so — exactly like
// liveness signals (livenessChannel.ts) — it must NOT ride the encrypted
// inbox: parseEnvelope -> assertWellFormed would reject it outright, and
// forcing it to masquerade as an Attestation would distort the one-envelope
// standard.
//
// This channel also is NOT the deeplink transport (parseSignRequest.ts /
// approveRequest.ts / declineRequest.ts), which redirects via
// window.location.href to a callback URL. A vault co-signer using this
// channel may be offline when the request is sent and open their wallet
// hours later — there is no live tab to redirect. Responses instead publish
// back over this same channel, addressed to the requester's own ephemeral
// pubkey (DynastyTrust generates a fresh, one-off Nostr keypair per request
// — never a persisted identity — since it only needs a mailbox for one
// round trip).
//
// RAILS (same as livenessChannel.ts):
//  - Relays only ever see ciphertext. The request/response JSON is NIP-44
//    v2 encrypted to the recipient before publish.
//  - The wallet's own re-verification (findVaultTrail, isKnownLeafScript,
//    requiresCallbackConfirmation — all inside signPsbtCosign) is the real
//    gate, not this transport. This module only carries bytes; it makes no
//    trust decision about whether to sign.
//  - The private key never crosses this module's boundary. The Wallet
//    performs the encryption (nip44EncryptTo / nip44DecryptFromAnyKey) and
//    the outer event signing (signDigest) internally.
//  - Every failure path drops silently — bad outer sig, bad decrypt,
//    malformed JSON, missing required field, duplicate event id. Nothing is
//    ever thrown to the receive handler.

/**
 * Custom event kind for an encrypted vault-sign request/response. A sibling
 * to TAPIT_ENVELOPE_KIND (9573) and TAPIT_LIVENESS_KIND (9575) — 9574 is the
 * retired custom chat kind, so the next free sibling is 9576. Both the
 * request (DynastyTrust -> Tapit) and the response (Tapit -> DynastyTrust)
 * ride this same kind; they are distinguished by shape (VaultSignRequestPayload
 * has `psbt_hex` + `vault_descriptor`; VaultSignResponsePayload has `ok`).
 */
export const TAPIT_VAULT_SIGN_KIND = 9576;

/**
 * The wire shape of an outbound psbt-cosign request. Re-declared here
 * rather than importing PsbtCosignSignRequest from ../sign-request/types.ts
 * so this transport module does not depend on the feature module (the
 * dependency points the other way: the feature wires this in) — same
 * reasoning as LivenessSignal in livenessChannel.ts. No `callback` field:
 * unlike the deeplink transport, the reply address is simply the event's
 * own sender pubkey, not a URL.
 */
export interface VaultSignRequestPayload {
  v: 1;
  /** Display name of the requesting app, e.g. "DynastyTrust". Not trusted
   *  for anything security-relevant — shown on the approval banner only. */
  origin: string;
  psbt_hex: string;
  vault_descriptor: string;
  vault_name?: string;
  /** Echoed back in the response so the requester can match it to the
   *  pending request it sent (mirrors SignRequestBase.nonce). */
  nonce?: string;
}

export type VaultSignResponsePayload =
  | { v: 1; ok: true; nonce?: string; psbt_hex: string }
  | { v: 1; ok: false; nonce?: string; reason: string; detail?: string };

export interface SendVaultSignOptions {
  /** Override the timestamp — tests use a fixed value for determinism. */
  created_at?: number;
}

export interface SendVaultSignResult {
  event: TransportEvent;
  publish: PublishResult;
}

/**
 * Encrypt and publish a vault-sign RESPONSE (grant or decline) back to the
 * requester's pubkey — the mirror image of sendLivenessSignal. Used by the
 * Tapit wallet after signPsbtCosign succeeds or the operator declines. The
 * Wallet does the NIP-44 encryption and the outer event signing internally;
 * this function never sees a raw private key.
 */
export async function sendVaultSignResponse(
  transport: Transport,
  response: VaultSignResponsePayload,
  recipientPubkey: string,
  sender: Wallet,
  options: SendVaultSignOptions = {},
): Promise<SendVaultSignResult> {
  const plaintext = JSON.stringify(response);
  const ciphertext = sender.nip44EncryptTo(plaintext, recipientPubkey);
  const event = await buildEvent({
    pubkey: sender.publicKey,
    sign: (digest) => sender.signDigest(digest),
    kind: TAPIT_VAULT_SIGN_KIND,
    content: ciphertext,
    tags: [['p', recipientPubkey]],
    created_at: options.created_at,
  });
  const publish = await transport.publish(event);
  return { event, publish };
}

export interface IncomingVaultSignRequest {
  payload: VaultSignRequestPayload;
  /** The requester's (ephemeral) pubkey — send the response here. */
  requesterPubkey: string;
  eventId: string;
  receivedAt: number;
}

export type VaultSignRequestHandler = (item: IncomingVaultSignRequest) => void;

/**
 * Subscribe to encrypted vault-sign requests addressed to the wallet's
 * pubkey on the dedicated vault-sign kind. Each event is verified
 * (signature + id match), decrypted with the wallet's private key, and
 * JSON-parsed + structurally validated. Only a well-formed, MAC-valid,
 * non-duplicate request reaches the handler — this function makes no trust
 * decision beyond shape; findVaultTrail/signPsbtCosign do the real
 * verification when the operator acts on it.
 *
 * The optional `since` filter (Unix seconds) is forwarded to the transport
 * so a wallet coming online only asks for events newer than its last sync.
 */
export function subscribeVaultSignRequests(
  transport: Transport,
  recipient: Wallet,
  onRequest: VaultSignRequestHandler,
  options: { since?: number } = {},
): Subscription {
  const seen = new Set<string>();
  const handler: TransportEventHandler = (event) => {
    void handleIncomingRequest(event, recipient, onRequest, seen);
  };
  return transport.subscribe(
    {
      kinds: [TAPIT_VAULT_SIGN_KIND],
      // Every key this wallet has ever used, not just the active one — same
      // reasoning as subscribeInbox/subscribeLiveness: a requester who
      // resolved this wallet's pubkey before a rotation still addresses the
      // request to a retired key.
      '#p': recipient.keyHistory,
      ...(options.since !== undefined ? { since: options.since } : {}),
    },
    handler,
  );
}

async function handleIncomingRequest(
  event: TransportEvent,
  recipient: Wallet,
  onRequest: VaultSignRequestHandler,
  seen: Set<string>,
): Promise<void> {
  if (seen.has(event.id)) return;
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
  const payload = narrowToVaultSignRequest(parsed);
  if (!payload) return;
  seen.add(event.id);
  onRequest({
    payload,
    requesterPubkey: event.pubkey,
    eventId: event.id,
    receivedAt: event.created_at,
  });
}

/**
 * Structural validation only — a shape gate so downstream code (the modal,
 * signPsbtCosign) receives the right fields. This does NOT validate that
 * psbt_hex actually parses as a PSBT; the modal does that with parsePsbt
 * before rendering, exactly like SignApprovalScreen does for the deeplink
 * transport, so a malformed PSBT surfaces as a clear error rather than a
 * silently dropped event.
 */
function narrowToVaultSignRequest(raw: unknown): VaultSignRequestPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return null;
  if (typeof o.origin !== 'string' || o.origin.length === 0) return null;
  if (typeof o.psbt_hex !== 'string' || o.psbt_hex.length === 0) return null;
  if (typeof o.vault_descriptor !== 'string' || o.vault_descriptor.length === 0) return null;
  return {
    v: 1,
    origin: o.origin,
    psbt_hex: o.psbt_hex,
    vault_descriptor: o.vault_descriptor,
    ...(typeof o.vault_name === 'string' ? { vault_name: o.vault_name } : {}),
    ...(typeof o.nonce === 'string' ? { nonce: o.nonce } : {}),
  };
}
