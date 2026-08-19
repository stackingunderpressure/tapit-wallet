import type { Wallet } from 'tapit-attest';
import {
  eventPTags,
  verifyEvent,
  type TransportEvent,
} from '../transport/nostrEvent.ts';
import type {
  Subscription,
  Transport,
  TransportEventHandler,
} from '../transport/transport.ts';
import { channelDiagnostics } from '../transport/channelDiagnostics.ts';
import { processedChannelEventsStore } from '../storage/processedChannelEventsStore.ts';
import type { SignInSignRequest } from './types.ts';

const CHANNEL_NAME = 'sign-in';

// DynastyTrust repo, tapit-signin-request-delivery.ts -- operator: "every
// time it sends me to the tap wallet it's a completely new login screen
// even though the browser is logged in just fine... they're not PWAs on
// a home screen... I wanted a different way for DynastyTrust to join...
// a place to put the 64 digit public key from Tapit into there and then
// it can do all of the Nostr messaging back and forth after that."
//
// wallet-signin.ts's two existing paths (the plain redirect, and "open
// Tapit directly" inside the QR-connect modal) both navigate the browser
// to this wallet's own site as a fresh, top-level page load, which
// re-initializes the SPA from scratch and re-triggers its local
// passphrase/unlock gate on an already-open wallet -- indistinguishable
// from onboarding to someone who wasn't expecting it. This channel lets
// the SAME sign-in challenge (approveRequest.ts's intent 'sign-in'
// branch already supports a response_channel-carried Nostr reply, unchanged
// since the QR flow shipped) arrive without any page load at all: DynastyTrust
// addresses the request directly to a pubkey the operator already knows,
// this wallet picks it up in its own already-open Inbox, and approving
// routes through in-app client-side navigation to the SAME /sign review
// screen a deeplink uses -- mirroring psbtCosignChannel.ts /
// vaultMembershipChannel.ts exactly, just for intent 'sign-in' instead.
//
// Deliberately its own event kind (9583, the next free sibling after
// this wallet's own sign-in RESPONSE channel's 9582) for the same reason
// every other request channel here has one: a SignInSignRequest is not
// an Attestation (no Merkle field tree, nothing to hold or anchor), so
// riding the envelope inbox would force every envelope-inbox consumer to
// defensively type-check content it was never meant to see.
export const SIGN_IN_REQUEST_KIND = 9583;

export interface InboxSignInRequest {
  request: SignInSignRequest;
  senderPubkey: string;
  receivedAt: number;
  eventId: string;
}

export type SignInRequestHandler = (item: InboxSignInRequest) => void;

function isHexBytes(v: unknown, bytes: number): v is string {
  return typeof v === 'string' && new RegExp(`^[0-9a-fA-F]{${bytes * 2}}$`).test(v);
}

/** Same challenge-shape check parseSignRequest.ts's requireSignInChallenge
 *  enforces for a deeplink-delivered request -- kept in sync deliberately
 *  so a request arriving over either transport is held to the identical
 *  bar before the operator is ever asked to approve it. */
function isValidChallenge(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  return (
    c.v === 1 &&
    isHexBytes(c.nonce, 32) &&
    typeof c.audience === 'string' && c.audience.length > 0 &&
    typeof c.issuedAt === 'string' && c.issuedAt.length > 0 &&
    typeof c.expiresAt === 'string' && c.expiresAt.length > 0
  );
}

function isValidResponseChannel(v: unknown): v is { kind: 'nostr'; requester_pubkey: string } {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return r.kind === 'nostr' && isHexBytes(r.requester_pubkey, 32);
}

function isSignInSignRequest(v: unknown): v is SignInSignRequest {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    r.v === 1 &&
    r.intent === 'sign-in' &&
    typeof r.origin === 'string' && r.origin.length > 0 &&
    typeof r.callback === 'string' && r.callback.length > 0 &&
    isValidChallenge(r.challenge) &&
    (r.response_channel === undefined || isValidResponseChannel(r.response_channel))
  );
}

/** Diagnostic-only -- names which specific check failed. Never used to
 *  gate real behavior; isSignInSignRequest above is the actual guard. */
function describeSchemaFailure(v: unknown): string {
  if (!v || typeof v !== 'object') return 'payload is not an object';
  const r = v as Record<string, unknown>;
  if (r.v !== 1) return `v=${JSON.stringify(r.v)} (expected 1)`;
  if (r.intent !== 'sign-in') return `intent=${JSON.stringify(r.intent)} (expected 'sign-in')`;
  if (typeof r.origin !== 'string' || r.origin.length === 0) return 'origin missing/empty';
  if (typeof r.callback !== 'string' || r.callback.length === 0) return 'callback missing/empty';
  if (!isValidChallenge(r.challenge)) return 'challenge missing/malformed';
  if (r.response_channel !== undefined && !isValidResponseChannel(r.response_channel)) {
    return 'response_channel present but malformed';
  }
  return 'unknown (guard and describe disagree)';
}

/**
 * Subscribe to sign-in requests addressed to the wallet's pubkey. Same
 * shape discipline as subscribePsbtCosignRequests/subscribeVaultMembershipRequests:
 * every event is verified before decrypt, and a tampered, mis-routed, or
 * malformed event is silently dropped -- a hostile relay gets no reaction
 * to distinguish "wrong key" from "garbage" from "not a sign-in event at all."
 */
export function subscribeSignInRequests(
  transport: Transport,
  recipient: Wallet,
  onRequest: SignInRequestHandler,
  options: { since?: number } = {},
): Subscription {
  const handler: TransportEventHandler = (event) => {
    void handleIncoming(event, recipient, onRequest);
  };
  return transport.subscribe(
    {
      kinds: [SIGN_IN_REQUEST_KIND],
      '#p': recipient.keyHistory,
      ...(options.since !== undefined ? { since: options.since } : {}),
    },
    handler,
  );
}

async function handleIncoming(
  event: TransportEvent,
  recipient: Wallet,
  onRequest: SignInRequestHandler,
): Promise<void> {
  if (await processedChannelEventsStore.isKnownFailure(recipient.identity, CHANNEL_NAME, event.id)) {
    return;
  }
  if (!(await verifyEvent(event))) {
    void channelDiagnostics.record('sign-in', 'verify_failed', `pubkey=${event.pubkey?.slice(0, 12)}`);
    void processedChannelEventsStore.markFailure(recipient.identity, CHANNEL_NAME, event.id);
    return;
  }
  let plaintext: string;
  try {
    plaintext = recipient.nip44DecryptFromAnyKey(event.content, event.pubkey);
  } catch (e) {
    // See psbtCosignChannel.ts's matching branch: a pre-rotation key can
    // permanently lose its own private half (git history 37468e2), so a
    // decrypt failure addressed to an older identity in this wallet's
    // history can never succeed on retry.
    const pTags = eventPTags(event);
    const addressedToMe = recipient.keyHistory.some((k) => pTags.includes(k.toLowerCase()));
    const matchedIsCurrentKey = pTags.includes(recipient.publicKey.toLowerCase());
    void channelDiagnostics.record(
      'sign-in',
      'decrypt_failed',
      `sender=${event.pubkey?.slice(0, 12)} err=${e instanceof Error ? e.message : String(e)}`,
      { addressedToMe, matchedIsCurrentKey },
    );
    void processedChannelEventsStore.markFailure(recipient.identity, CHANNEL_NAME, event.id);
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch (e) {
    void channelDiagnostics.record('sign-in', 'parse_failed', e instanceof Error ? e.message : String(e));
    void processedChannelEventsStore.markFailure(recipient.identity, CHANNEL_NAME, event.id);
    return;
  }
  if (!isSignInSignRequest(parsed)) {
    void channelDiagnostics.record('sign-in', 'schema_failed', describeSchemaFailure(parsed));
    void processedChannelEventsStore.markFailure(recipient.identity, CHANNEL_NAME, event.id);
    return;
  }
  void channelDiagnostics.record('sign-in', 'delivered');
  onRequest({
    request: parsed,
    senderPubkey: event.pubkey,
    receivedAt: event.created_at,
    eventId: event.id,
  });
}
