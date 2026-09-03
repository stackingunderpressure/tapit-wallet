import { signDigest, verifySignature, publicKeyFromPrivate } from 'tapit-attest';
import { roundDigest, type PriceRoundFields } from './priceRoundCanonical.ts';

// A signed price round — the datum a move binds to. The oracle (our tiny
// signer, netlify/functions/price-oracle) fetches a real exchange price
// and signs the canonical round with its own BIP340 key; the browser
// verifies against the oracle's known pubkey with the SAME Schnorr
// primitives tapit-attest already uses. No new crypto, no new dependency.
// See ARENA_SPEC.md.

export interface SignedPriceRound extends PriceRoundFields {
  /** The oracle's x-only BIP340 public key (hex). */
  pubkey: string;
  /** Schnorr signature (hex) over roundDigest(fields). */
  sig: string;
}

/** Reference signer — also what the serverless oracle uses. */
export function signPriceRound(f: PriceRoundFields, privateKey: string): SignedPriceRound {
  return {
    ...f,
    pubkey: publicKeyFromPrivate(privateKey),
    sig: signDigest(roundDigest(f), privateKey),
  };
}

/**
 * Verify a signed round. When `expectedPubkey` is given the round must be
 * from that exact oracle. Returns false (never throws) on any bad input.
 */
export function verifyPriceRound(r: SignedPriceRound, expectedPubkey?: string): boolean {
  if (!r || typeof r.pubkey !== 'string' || typeof r.sig !== 'string') return false;
  if (expectedPubkey && r.pubkey.toLowerCase() !== expectedPubkey.toLowerCase()) return false;
  if (!Number.isFinite(r.price) || r.price <= 0) return false;
  if (!Number.isFinite(r.time) || !Number.isFinite(r.round)) return false;
  try {
    return verifySignature(roundDigest(r), r.sig, r.pubkey);
  } catch {
    return false;
  }
}

/** Fetch the latest signed round from the oracle and verify it before use. */
export async function fetchSignedRound(
  url: string,
  expectedPubkey?: string,
): Promise<SignedPriceRound> {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Oracle returned ${res.status}`);
  const r = (await res.json()) as SignedPriceRound;
  if (!verifyPriceRound(r, expectedPubkey)) {
    throw new Error('Oracle signature did not verify — not using this price.');
  }
  return r;
}
