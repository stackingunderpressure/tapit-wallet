import { sha256 } from '@noble/hashes/sha256';

// The ONE canonical serialization of a price round, shared by the signer
// (the netlify/price-oracle function) and the browser verifier so the two
// can never drift. Depends ONLY on @noble/hashes — no tapit-attest, no
// browser/Node-specific API — so it is safe to import from both the Vite
// bundle and a serverless function bundle. A test pins the exact bytes.
//
// Shape is Nostr-event-flavoured (a fixed-order array, no whitespace) so a
// real NIP-88 / signed-price-event oracle can later drop in with the same
// verify path. See ARENA_SPEC.md — "the price source = a signed oracle".

export interface PriceRoundFields {
  /** BTC/USD price the oracle is attesting. */
  price: number;
  /** Unix seconds the reading was taken. */
  time: number;
  /** Where the price came from, e.g. 'coinbase'. */
  source: string;
  /** Monotonic round id (the signer uses unix seconds). */
  round: number;
}

/**
 * The exact string both sides hash. Fixed field order, JSON with no
 * spaces. The leading [0,'price-round'] tag namespaces it so a signature
 * over a price round can never be replayed as a signature over anything
 * else.
 */
export function canonicalRoundString(f: PriceRoundFields): string {
  return JSON.stringify([0, 'price-round', f.round, f.time, f.source, f.price]);
}

/** sha256 of the canonical string — the digest the oracle key signs. */
export function roundDigest(f: PriceRoundFields): Uint8Array {
  return sha256(new TextEncoder().encode(canonicalRoundString(f)));
}
