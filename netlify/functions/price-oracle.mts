import { schnorr } from '@noble/curves/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { roundDigest } from '../../src/features/arena/priceRoundCanonical.ts';

// The tiny signed price oracle for Beat the HODL (ARENA_SPEC.md, oracle
// decision = "our own tiny signed round", 2026-09-03). It fetches a real
// BTC/USD price from a public exchange and signs a canonical round with
// the oracle's own BIP340 key, so anyone can verify the price against a
// known pubkey with plain Schnorr — the DLC-oracle property, without
// depending on a public Nostr oracle (none reliable exists as of 2026).
//
// It signs the SAME roundDigest the browser verifier checks (imported
// from the shared canonical module, so signer and verifier cannot drift),
// and its output is Nostr-event-shaped so a real NIP-88 oracle can drop in
// later with no client change.
//
// SECRET: ARENA_ORACLE_PRIVATE_KEY (a 32-byte hex BIP340 key) lives ONLY
// in Netlify env — never committed, never in the browser bundle. Generate
// one with tapit-attest's generateKeypair (or any BIP340 keygen) and set
// it in Netlify. Publish the matching pubkey to clients as
// VITE_ARENA_ORACLE_PUBKEY. NOT smoke-tested from the build sandbox.

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'content-type': 'application/json',
};

async function fetchBtcUsd(): Promise<{ price: number; source: string }> {
  try {
    const r = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot');
    if (r.ok) {
      const j = (await r.json()) as { data?: { amount?: string } };
      const p = Number(j?.data?.amount);
      if (Number.isFinite(p) && p > 0) return { price: p, source: 'coinbase' };
    }
  } catch {
    /* fall through to the backup feed */
  }
  const r2 = await fetch('https://api.kraken.com/0/public/Ticker?pair=XBTUSD');
  const j2 = (await r2.json()) as { result?: { XXBTZUSD?: { c?: string[] } } };
  const p2 = Number(j2?.result?.XXBTZUSD?.c?.[0]);
  if (!Number.isFinite(p2) || p2 <= 0) throw new Error('no price from any feed');
  return { price: p2, source: 'kraken' };
}

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const priv = process.env.ARENA_ORACLE_PRIVATE_KEY;
  if (!priv) {
    return new Response(JSON.stringify({ error: 'oracle key not configured' }), {
      status: 503,
      headers: CORS,
    });
  }
  try {
    const { price, source } = await fetchBtcUsd();
    const time = Math.floor(Date.now() / 1000);
    const fields = { price, time, source, round: time };
    const digest = roundDigest(fields);
    const sig = bytesToHex(schnorr.sign(digest, hexToBytes(priv)));
    const pubkey = bytesToHex(schnorr.getPublicKey(hexToBytes(priv)));
    return new Response(JSON.stringify({ ...fields, pubkey, sig }), {
      headers: { ...CORS, 'cache-control': 'no-store' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'oracle failed' }),
      { status: 502, headers: CORS },
    );
  }
};

export const config = { path: '/api/price-oracle' };
