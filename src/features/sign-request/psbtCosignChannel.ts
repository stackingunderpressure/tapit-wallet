import type { Wallet } from 'tapit-attest';
import {
  buildEvent,
  eventPTags,
  verifyEvent,
  type TransportEvent,
} from '../transport/nostrEvent.ts';
import type {
  PublishResult,
  Subscription,
  Transport,
  TransportEventHandler,
} from '../transport/transport.ts';
import type { PsbtCosignSignRequest } from './types.ts';
import { channelDiagnostics } from '../transport/channelDiagnostics.ts';
import { processedChannelEventsStore } from '../storage/processedChannelEventsStore.ts';

const CHANNEL_NAME = 'psbt-cosign';

// Cut B stage B3 (docs/integration-phase1-signin-and-bridge.md, DynastyTrust
// repo) -- the Nostr half of the multi-member signing bridge. B2 delivers a
// psbt-cosign request over a deeplink into a NEW TAB, which only works when
// the signer and the requester share a browser. A circle member on their
// own phone, in their own Tapit, needs the request to arrive without a link
// being handed to them by hand -- this is that channel.
//
// Deliberately its own event kind (9576, the next free sibling after the
// liveness channel's 9575) rather than riding TAPIT_ENVELOPE_KIND: a
// psbt-cosign request is not an Attestation (no Merkle field tree, nothing
// to hold or anchor), so shoehorning it into the envelope inbox would force
// every envelope-inbox consumer to defensively type-check content it was
// never meant to see. Mirrors encryptedInbox.ts's sendEnvelopeTo/
// subscribeInbox shape exactly -- same NIP-44-to-one-recipient pattern,
// same verify-then-decrypt-then-parse discipline, different payload type.
//
// This module ONLY moves the request and (later, once approveRequest grows
// a non-redirect delivery path) the signed response across the wire. It
// never signs anything itself -- signing still goes through
// approveSignRequest -> signPsbtCosign, unchanged, with every rail from the
// risk register ("no rogue signing," the attested-trail check, the
// callback-verification gate) still enforced there, regardless of which
// transport carried the request in.
export const PSBT_COSIGN_REQUEST_KIND = 9576;

/**
 * Publish a psbt-cosign request, NIP-44-encrypted to the recipient's
 * x-only pubkey, over the given transport. `sender` is normally an
 * EPHEMERAL per-request identity (a fresh keypair minted just for this
 * request), not the requester's own long-lived key -- DynastyTrust has
 * no persistent Tapit identity of its own to sign as, and an ephemeral
 * sender means a relay operator watching the wire learns nothing about
 * which DynastyTrust account issued the request. The recipient does not
 * need to trust the sender's identity to decide whether to sign; that
 * trust lives entirely in the attested vault-membership trail
 * (vaultTrail.ts), checked against the PSBT's own leaf scripts, not
 * against who published the event.
 */
export interface SendPsbtCosignRequestResult {
  event: TransportEvent;
  publish: PublishResult;
}

export async function sendPsbtCosignRequestTo(
  transport: Transport,
  request: PsbtCosignSignRequest,
  recipientPubkey: string,
  sender: Wallet,
): Promise<SendPsbtCosignRequestResult> {
  const plaintext = JSON.stringify(request);
  const ciphertext = sender.nip44EncryptTo(plaintext, recipientPubkey);
  const event = await buildEvent({
    pubkey: sender.publicKey,
    sign: (digest) => sender.signDigest(digest),
    kind: PSBT_COSIGN_REQUEST_KIND,
    content: ciphertext,
    tags: [['p', recipientPubkey]],
  });
  const publish = await transport.publish(event);
  return { event, publish };
}

export interface InboxPsbtCosignRequest {
  request: PsbtCosignSignRequest;
  senderPubkey: string;
  receivedAt: number;
  eventId: string;
}

export type PsbtCosignRequestHandler = (item: InboxPsbtCosignRequest) => void;

/**
 * Subscribe to psbt-cosign requests addressed to the wallet's pubkey.
 * Same shape discipline as subscribeInbox: every event is verified
 * (signature + id match) before decrypt, and a tampered, mis-routed, or
 * malformed event is silently dropped rather than surfaced -- a hostile
 * relay gets no reaction to distinguish "wrong key" from "garbage" from
 * "not a psbt-cosign event at all."
 *
 * Subscribes on every key this wallet has ever used, same reasoning as
 * subscribeInbox/subscribeChatMessages: a requester who resolved this
 * wallet's pubkey before a rotation still addresses the request to the
 * pre-rotation key.
 */
export function subscribePsbtCosignRequests(
  transport: Transport,
  recipient: Wallet,
  onRequest: PsbtCosignRequestHandler,
  options: { since?: number } = {},
): Subscription {
  const handler: TransportEventHandler = (event) => {
    void handleIncoming(event, recipient, onRequest);
  };
  return transport.subscribe(
    {
      kinds: [PSBT_COSIGN_REQUEST_KIND],
      '#p': recipient.keyHistory,
      ...(options.since !== undefined ? { since: options.since } : {}),
    },
    handler,
  );
}

function isPsbtCosignSignRequest(v: unknown): v is PsbtCosignSignRequest {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    r.v === 1 &&
    r.intent === 'psbt-cosign' &&
    typeof r.origin === 'string' &&
    typeof r.callback === 'string' &&
    typeof r.psbt_hex === 'string' &&
    r.psbt_hex.length > 0 &&
    !!r.vault_context &&
    typeof r.vault_context === 'object' &&
    typeof (r.vault_context as Record<string, unknown>).vault_descriptor === 'string'
  );
}

/** Diagnostic-only -- names which specific check failed. Never used to
 *  gate real behavior; isPsbtCosignSignRequest above is the actual guard. */
function describeSchemaFailure(v: unknown): string {
  if (!v || typeof v !== 'object') return 'payload is not an object';
  const r = v as Record<string, unknown>;
  if (r.v !== 1) return `v=${JSON.stringify(r.v)} (expected 1)`;
  if (r.intent !== 'psbt-cosign') return `intent=${JSON.stringify(r.intent)} (expected 'psbt-cosign')`;
  if (typeof r.origin !== 'string') return 'origin missing/not a string';
  if (typeof r.callback !== 'string') return 'callback missing/not a string';
  if (typeof r.psbt_hex !== 'string' || r.psbt_hex.length === 0) return 'psbt_hex missing/empty';
  if (!r.vault_context || typeof r.vault_context !== 'object') return 'vault_context missing/not an object';
  if (typeof (r.vault_context as Record<string, unknown>).vault_descriptor !== 'string') {
    return 'vault_context.vault_descriptor missing/not a string';
  }
  return 'unknown (guard and describe disagree)';
}

async function handleIncoming(
  event: TransportEvent,
  recipient: Wallet,
  onRequest: PsbtCosignRequestHandler,
): Promise<void> {
  // 2026-08-11 fix: both channels subscribe with no `since` cutoff, so a
  // relay re-serves its whole matching backlog on every fresh subscribe.
  // An event already known to fail can never succeed on a retry -- Nostr
  // events are immutable once signed -- so skip re-attempting verify/
  // decrypt/parse (and re-logging it) entirely. See
  // processedChannelEventsStore.ts's header for the full account.
  if (await processedChannelEventsStore.isKnownFailure(recipient.identity, CHANNEL_NAME, event.id)) {
    return;
  }
  if (!(await verifyEvent(event))) {
    void channelDiagnostics.record('psbt-cosign', 'verify_failed', `pubkey=${event.pubkey?.slice(0, 12)}`);
    void processedChannelEventsStore.markFailure(recipient.identity, CHANNEL_NAME, event.id);
    return;
  }
  let plaintext: string;
  try {
    plaintext = recipient.nip44DecryptFromAnyKey(event.content, event.pubkey);
  } catch (e) {
    // Operator, 2026-08-10 (round 3): confirmed addressedToMe=true,
    // matchedIsCurrentKey=false, repeatedly -- the request is genuinely
    // addressed to an OLDER identity in this wallet's history, not the
    // current one, and no key this wallet actually tries can open it.
    // Ground truth from git history (37468e2, 2026-05-31): Wallet.rotate()
    // discarded the retiring private key entirely until that fix landed;
    // its own commit message says plainly "a key already rotated away
    // BEFORE this fix was discarded at that time and is unrecoverable
    // except by restoring a pre-rotation backup." A rotation done in the
    // ~week window rotation was live before that fix (shipped 2026-05-24,
    // fixed 2026-05-31) permanently lost that key's private half -- no
    // code change can bring it back. keyMatch is now structured (not just
    // embedded in `detail`) so NostrActivitySection can render the plain-
    // language explanation instead of the raw facts.
    const pTags = eventPTags(event);
    const addressedToMe = recipient.keyHistory.some((k) => pTags.includes(k.toLowerCase()));
    const matchedIsCurrentKey = pTags.includes(recipient.publicKey.toLowerCase());
    void channelDiagnostics.record(
      'psbt-cosign',
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
    void channelDiagnostics.record('psbt-cosign', 'parse_failed', e instanceof Error ? e.message : String(e));
    void processedChannelEventsStore.markFailure(recipient.identity, CHANNEL_NAME, event.id);
    return;
  }
  if (!isPsbtCosignSignRequest(parsed)) {
    void channelDiagnostics.record('psbt-cosign', 'schema_failed', describeSchemaFailure(parsed));
    void processedChannelEventsStore.markFailure(recipient.identity, CHANNEL_NAME, event.id);
    return;
  }
  void channelDiagnostics.record('psbt-cosign', 'delivered');
  onRequest({
    request: parsed,
    senderPubkey: event.pubkey,
    receivedAt: event.created_at,
    eventId: event.id,
  });
}
