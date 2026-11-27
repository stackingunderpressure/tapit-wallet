import type { Wallet } from 'tapit-attest';
import { eventPTags, verifyEvent, type TransportEvent } from '../transport/nostrEvent.ts';
import type { Subscription, Transport, TransportEventHandler } from '../transport/transport.ts';
import { channelDiagnostics, type ChannelStage, type KeyMatchFacts } from '../transport/channelDiagnostics.ts';
import { processedChannelEventsStore } from '../storage/processedChannelEventsStore.ts';
import { parseSignRequestJson } from './parseSignRequest.ts';
import type { AttestSignRequest, CosignSignRequest } from './types.ts';

// Record requests -- intent 'attest' (sign a new record) or 'cosign-existing'
// (add this wallet's signature to one) -- arriving over Nostr instead of a
// redirect. Mirrors signInChannel.ts: the requesting app addresses the
// request to a pubkey it already knows, this wallet picks it up while it is
// open and unlocked, and Review routes in-app to the SAME /sign screen a
// deeplink uses -- no page load, so no unlock screen again.
//
// Operator, 2026-11-27, on the Family Bitcoin Game's redirect flow: the
// redirect reloaded Tapit and asked for the passphrase on every sign.
//
// Its own kind (9585, the next free after the move channel's 9584).
// Validation is parseSignRequestJson -- the exact bar a deeplink is held
// to -- plus a required response_channel, since a request that came over
// the network has nowhere to redirect to.
export const RECORD_REQUEST_KIND = 9585;

const CHANNEL_NAME = 'record';

export type RecordRequest = (AttestSignRequest | CosignSignRequest) & {
  response_channel: { kind: 'nostr'; requester_pubkey: string };
};

export interface InboxRecordRequest {
  request: RecordRequest;
  senderPubkey: string;
  receivedAt: number;
  eventId: string;
}

export type RecordRequestHandler = (item: InboxRecordRequest) => void;

/** Parse and hold a decrypted payload to the deeplink bar. Exported for tests. */
export function readRecordRequest(json: unknown): RecordRequest | null {
  try {
    const r = parseSignRequestJson(json);
    if (r.intent !== 'attest' && r.intent !== 'cosign-existing') return null;
    if (r.response_channel?.kind !== 'nostr') return null;
    return r as RecordRequest;
  } catch {
    return null;
  }
}

export function subscribeRecordRequests(
  transport: Transport,
  recipient: Wallet,
  onRequest: RecordRequestHandler,
  options: { since?: number } = {},
): Subscription {
  const handler: TransportEventHandler = (event) => {
    void handleIncoming(event, recipient, onRequest);
  };
  return transport.subscribe(
    {
      kinds: [RECORD_REQUEST_KIND],
      '#p': recipient.keyHistory,
      ...(options.since !== undefined ? { since: options.since } : {}),
    },
    handler,
  );
}

async function handleIncoming(event: TransportEvent, recipient: Wallet, onRequest: RecordRequestHandler): Promise<void> {
  if (await processedChannelEventsStore.isKnownFailure(recipient.identity, CHANNEL_NAME, event.id)) return;
  const fail = (step: ChannelStage, detail: string, extra?: KeyMatchFacts) => {
    void channelDiagnostics.record(CHANNEL_NAME, step, detail, extra);
    void processedChannelEventsStore.markFailure(recipient.identity, CHANNEL_NAME, event.id);
  };
  if (!(await verifyEvent(event))) return fail('verify_failed', `pubkey=${event.pubkey?.slice(0, 12)}`);
  let plaintext: string;
  try {
    plaintext = recipient.nip44DecryptFromAnyKey(event.content, event.pubkey);
  } catch (e) {
    const pTags = eventPTags(event);
    return fail('decrypt_failed', `sender=${event.pubkey?.slice(0, 12)} err=${e instanceof Error ? e.message : String(e)}`, {
      addressedToMe: recipient.keyHistory.some((k) => pTags.includes(k.toLowerCase())),
      matchedIsCurrentKey: pTags.includes(recipient.publicKey.toLowerCase()),
    });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch (e) {
    return fail('parse_failed', e instanceof Error ? e.message : String(e));
  }
  const request = readRecordRequest(parsed);
  if (!request) return fail('schema_failed', 'not a record request with a Nostr reply address');
  void channelDiagnostics.record(CHANNEL_NAME, 'delivered');
  onRequest({ request, senderPubkey: event.pubkey, receivedAt: event.created_at, eventId: event.id });
}
