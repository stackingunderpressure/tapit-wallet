import {
  assertWellFormed,
  verifyEnvelope,
  type Attestation,
  type Wallet,
} from 'tapit-attest';
import { readMoveMeta, type MoveMeta } from '../move-chain/moveChain.ts';
import { buildEvent, verifyEvent, type TransportEvent } from './nostrEvent.ts';
import type { PublishResult, Subscription, Transport, TransportEventHandler } from './transport.ts';

// Public move-chain broadcast channel — the live wire under "Beat the
// HODL Machine" and any idea built on move-chain. Unlike the encrypted
// inbox (TAPIT_ENVELOPE_KIND, addressed + NIP-44) and the liveness
// channel (TAPIT_LIVENESS_KIND, encrypted), a move is meant for the
// WORLD: the whole point is that anyone can watch a chain go live and
// verify it. So a move rides its own kind, UNENCRYPTED, no `p` tag,
// signed by the wallet's real key — the same identity that signed the
// move attestation inside.
//
// A move IS an Attestation (unlike a liveness signal), so the receive
// half runs assertWellFormed + verifyEnvelope on the inner move, then
// binds the broadcaster to the author (the event's pubkey must be a
// valid signer on the move it carries). A relay or stranger cannot
// inject a fake move under someone else's name: the inner signature is
// re-checked and must come from the event author. Every failure path
// drops silently — bad outer sig, junk JSON, malformed attestation, bad
// inner sig, author/signer mismatch, or a duplicate event id.
//
// The private key never crosses this module. buildEvent signs the event
// id via wallet.signDigest; the inner move was already signed by
// wallet.attest in the move-chain layer.

/**
 * Custom kind for a public move-chain event. Regular range (1000–9999)
 * so relays persist it for async delivery; a distinct sibling to the
 * envelope (9573) / liveness (9575) / sign-in (9582/9583) kinds. Public
 * and unencrypted by design — a move is world-readable, so a verifier
 * anywhere can reassemble and check a chain.
 */
export const MOVE_EVENT_KIND = 9584;

export interface PublishMoveOptions {
  /** Groups moves for one idea (the `t` hashtag), e.g. 'beatthehodl'. */
  topic: string;
  /** The chain's genesis link (moveLink of move 0); omit on the genesis
   *  move itself. Lets a verifier filter one exact chain by `#e`. */
  genesisId?: string;
  /** Override the timestamp — tests use a fixed value for determinism. */
  created_at?: number;
}

export interface PublishMoveResult {
  event: TransportEvent;
  publish: PublishResult;
}

function moveTags(move: Attestation, options: PublishMoveOptions): string[][] {
  const meta = readMoveMeta(move);
  const tags: string[][] = [['t', options.topic]];
  if (meta) tags.push(['seq', String(meta.seq)]);
  // Every non-genesis move points at the chain's root so one chain is
  // filterable by `#e`. The genesis move IS the root and carries none.
  if (options.genesisId) tags.push(['e', options.genesisId, '', 'root']);
  return tags;
}

/**
 * Build a signed public Nostr event carrying one move attestation. The
 * move JSON rides in `content` verbatim; tags carry the topic, seq, and
 * (for non-genesis moves) the chain root. Exposed for tests; publishMove
 * wraps it with the transport.
 */
export async function buildMoveEvent(
  wallet: Wallet,
  move: Attestation,
  options: PublishMoveOptions,
): Promise<TransportEvent> {
  return buildEvent({
    pubkey: wallet.publicKey,
    sign: (digest) => wallet.signDigest(digest),
    kind: MOVE_EVENT_KIND,
    content: JSON.stringify(move),
    tags: moveTags(move, options),
    created_at: options.created_at,
  });
}

/**
 * Broadcast one signed move live to the relays. Returns the published
 * event plus the relay PublishResult. The move must already be signed
 * (via wallet.attest in the move-chain layer); this only wraps and
 * publishes it.
 */
export async function publishMove(
  transport: Transport,
  wallet: Wallet,
  move: Attestation,
  options: PublishMoveOptions,
): Promise<PublishMoveResult> {
  const event = await buildMoveEvent(wallet, move, options);
  const publish = await transport.publish(event);
  return { event, publish };
}

export interface IncomingMove {
  move: Attestation;
  meta: MoveMeta;
  senderPubkey: string;
  eventId: string;
  receivedAt: number;
}

export type MoveHandler = (incoming: IncomingMove) => void;

export interface SubscribeMovesOptions {
  /** Restrict to one idea's feed (the `t` hashtag). */
  topic?: string;
  /** Restrict to one exact chain by its genesis link (`#e`). */
  genesisId?: string;
  /** Unix seconds — ask only for events newer than the last sync. */
  since?: number;
}

/**
 * Subscribe to public moves. Each event is verified (outer id + sig),
 * its content parsed as an Attestation and structurally validated, the
 * INNER move signature re-verified, and the broadcaster bound to the
 * author (event pubkey must be a valid signer of the move). Only a
 * fully-valid, non-duplicate move reaches the handler; every failure
 * drops silently, exactly what a wallet wants from a hostile relay. The
 * handler receives moves in ARRIVAL order — use orderMoves +
 * verifyMoveChain from move-chain to assemble and check a whole chain.
 */
export function subscribeMoves(
  transport: Transport,
  options: SubscribeMovesOptions,
  onMove: MoveHandler,
): Subscription {
  const seen = new Set<string>();
  const handler: TransportEventHandler = (event) => {
    void handleIncoming(event, onMove, seen);
  };
  return transport.subscribe(
    {
      kinds: [MOVE_EVENT_KIND],
      ...(options.topic !== undefined ? { '#t': [options.topic] } : {}),
      ...(options.genesisId !== undefined ? { '#e': [options.genesisId] } : {}),
      ...(options.since !== undefined ? { since: options.since } : {}),
    },
    handler,
  );
}

async function handleIncoming(
  event: TransportEvent,
  onMove: MoveHandler,
  seen: Set<string>,
): Promise<void> {
  if (seen.has(event.id)) return;
  if (!(await verifyEvent(event))) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(event.content);
  } catch {
    return;
  }
  try {
    assertWellFormed(parsed);
  } catch {
    return;
  }
  const move = parsed as Attestation;
  const v = verifyEnvelope(move);
  if (!v.valid) return;
  // Bind the broadcaster to the move: whoever published this event must
  // be a valid signer of the move inside it. Stops a relay or stranger
  // from re-broadcasting or fabricating a move under a foreign name.
  if (!v.signers.some((s) => s.valid && s.signer === event.pubkey)) return;
  const meta = readMoveMeta(move);
  if (!meta) return;
  seen.add(event.id);
  onMove({ move, meta, senderPubkey: event.pubkey, eventId: event.id, receivedAt: event.created_at });
}
