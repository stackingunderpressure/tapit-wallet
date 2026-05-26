import { verifySignature } from 'tapit-attest';

// Nostr (NIP-01) event construction. We reuse the wallet's secp256k1
// key as the Nostr identity (D-11d) — same x-only pubkey, same
// BIP340 Schnorr signature. tapit-attest owns the crypto primitives;
// this module is wire-format glue only.
//
// A Nostr event is:
//   { id, pubkey, created_at, kind, tags, content, sig }
// The id is sha256 of the canonical serialization
//   [0, pubkey, created_at, kind, tags, content]
// JSON-stringified with no whitespace. The sig is a BIP340 Schnorr
// signature over that id, by the pubkey.

/**
 * Custom event kind for a Tapit-attest envelope wrapped in NIP-44
 * ciphertext. Sits in the regular-event range (1000–9999), so relays
 * persist it for async delivery. NIP-46 is reserved for the separate
 * app-to-wallet sign pathway (D-11c).
 *
 * Chat messages used to ride a sibling custom kind 9574 but migrated
 * to NIP-17 gift-wrapped messages (kind 1059) for cross-relay
 * reliability — see src/features/transport/nip17.ts. The envelope
 * path stays on the custom kind because envelopes are inherently
 * Tapit-shaped and never need cross-Nostr-client interop.
 */
export const TAPIT_ENVELOPE_KIND = 9573;

export type Tag = readonly string[];

export interface TransportEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: readonly Tag[];
  content: string;
  sig: string;
}

export interface TransportFilter {
  ids?: readonly string[];
  authors?: readonly string[];
  kinds?: readonly number[];
  since?: number;
  until?: number;
  limit?: number;
  /** Tag filters keyed by single-letter tag name (e.g. '#p', '#e'). */
  [tagFilter: `#${string}`]: readonly string[] | undefined;
}

function canonicalSerialize(
  pubkey: string,
  created_at: number,
  kind: number,
  tags: readonly Tag[],
  content: string,
): string {
  return JSON.stringify([0, pubkey, created_at, kind, tags, content]);
}

async function sha256Hex(data: string): Promise<string> {
  const bytes = new TextEncoder().encode(data);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes32(hex: string): Uint8Array {
  if (hex.length !== 64) throw new Error('expected 32-byte hex');
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export interface BuildEventInput {
  pubkey: string;
  /**
   * Signs the 32-byte event id with the wallet's active key. The
   * caller passes (digest) => wallet.signDigest(digest) — the private
   * key never crosses this boundary (D-03).
   */
  sign: (digest: Uint8Array) => string;
  kind: number;
  content: string;
  tags?: readonly Tag[];
  /** Override the timestamp — tests use a fixed value for determinism. */
  created_at?: number;
}

/**
 * Build, hash, and sign a Nostr event. Returns a TransportEvent ready
 * for publish().
 */
export async function buildEvent(input: BuildEventInput): Promise<TransportEvent> {
  const created_at = input.created_at ?? Math.floor(Date.now() / 1000);
  const tags = input.tags ?? [];
  const serialized = canonicalSerialize(
    input.pubkey,
    created_at,
    input.kind,
    tags,
    input.content,
  );
  const id = await sha256Hex(serialized);
  const sig = input.sign(hexToBytes32(id));
  return {
    id,
    pubkey: input.pubkey,
    created_at,
    kind: input.kind,
    tags,
    content: input.content,
    sig,
  };
}

/**
 * Verify a Nostr event: the id matches the canonical hash AND the
 * signature verifies under the pubkey. Returns false on any failure,
 * never throws. A relay can deliver garbage; the wallet must drop it.
 */
export async function verifyEvent(event: TransportEvent): Promise<boolean> {
  if (typeof event !== 'object' || event === null) return false;
  if (
    typeof event.id !== 'string' ||
    typeof event.pubkey !== 'string' ||
    typeof event.sig !== 'string' ||
    typeof event.content !== 'string' ||
    typeof event.kind !== 'number' ||
    typeof event.created_at !== 'number' ||
    !Array.isArray(event.tags)
  ) {
    return false;
  }
  const serialized = canonicalSerialize(
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  );
  const expectedId = await sha256Hex(serialized);
  if (expectedId !== event.id) return false;
  return verifySignature(hexToBytes32(event.id), event.sig, event.pubkey);
}
