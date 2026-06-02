import type { Wallet } from 'tapit-attest';
import { buildEvent, type TransportEvent } from './nostrEvent.ts';
import type { PublishResult, Transport } from './transport.ts';

// Kind-1 public note publishing (PLAN.md Tier 1 item 8, 2026-06-01).
// The wallet's pubkey IS its Nostr identity (D-11d); kind-1 is the
// standard Nostr "text note" every client renders in its feed. This
// lets the operator broadcast a journal entry (or any text) as a
// public note, signed by the same key as their kind-0 profile (item 7)
// so it appears in Damus / Primal / Amethyst under their real name.
//
// Public + encryption-free by design — the opposite of the envelope
// (TAPIT_ENVELOPE_KIND) and chat (NIP-17) paths, which are addressed
// and NIP-44-encrypted. A kind-1 note is meant for the world, so it
// rides the wallet's real key with no wrapping.
//
// Honest scope note: this publishes the note's TEXT. It deliberately
// does NOT embed a NIP-19 reference back to the signed tapit-attest
// envelope, because that envelope is not itself published to any
// public relay in this flow — a "fetch the bytes and verify" link
// would resolve to nothing. When envelope-publishing lands, add an
// `e`/`a` tag or an embedded nevent here. For now the value is the
// visible note under the operator's named identity.

/** NIP-01 kind-1 — a plain text note (the thing feeds render). */
export const NOSTR_NOTE_KIND = 1;

/**
 * Build a signed kind-1 text note for the wallet. The private key never
 * crosses the boundary — buildEvent signs the event id via
 * wallet.signDigest (D-03). `content` is published verbatim.
 */
export async function buildNoteEvent(
  wallet: Wallet,
  content: string,
  options: { created_at?: number } = {},
): Promise<TransportEvent> {
  return buildEvent({
    pubkey: wallet.publicKey,
    sign: (digest) => wallet.signDigest(digest),
    kind: NOSTR_NOTE_KIND,
    content,
    tags: [],
    created_at: options.created_at,
  });
}

/**
 * Build and publish a public kind-1 note in one call. Returns the
 * published event id plus the relay PublishResult. The provider's
 * publishPublicNote delegates here so its inline body stays small.
 */
export async function publishNote(
  transport: Transport,
  wallet: Wallet,
  content: string,
): Promise<{ eventId: string; publish: PublishResult }> {
  const event = await buildNoteEvent(wallet, content);
  const publish = await transport.publish(event);
  return { eventId: event.id, publish };
}

/**
 * Compose the note text from a journal entry's parts. Pure + testable.
 * A title (when present) becomes the first line, then the body. Trims
 * trailing whitespace; returns null when there's nothing to publish
 * (no title and no body) so the caller can disable the Share action.
 */
export function noteTextFromEntry(parts: {
  title?: string;
  text?: string;
}): string | null {
  const title = (parts.title ?? '').trim();
  const body = (parts.text ?? '').trim();
  if (title.length === 0 && body.length === 0) return null;
  if (title.length > 0 && body.length > 0) return `${title}\n\n${body}`;
  return title.length > 0 ? title : body;
}
