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

const ok = (p: number): boolean => Number.isFinite(p) && p > 0;

async function coinbase(): Promise<number> {
  const r = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot');
  const j = (await r.json()) as { data?: { amount?: string } };
  return Number(j?.data?.amount);
}
async function kraken(): Promise<number> {
  const r = await fetch('https://api.kraken.com/0/public/Ticker?pair=XBTUSD');
  const j = (await r.json()) as { result?: { XXBTZUSD?: { c?: string[] } } };
  return Number(j?.result?.XXBTZUSD?.c?.[0]);
}
async function bitstamp(): Promise<number> {
  const r = await fetch('https://www.bitstamp.net/api/v2/ticker/btcusd/');
  const j = (await r.json()) as { last?: string };
  return Number(j?.last);
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/**
 * BTC/USD as the MEDIAN of several independent exchanges, so no single feed
 * (a glitch, an outage, a manipulated book) can move the number the game
 * signs. Sources that fail or return junk are dropped; we require at least
 * two agreeing feeds, and reject if the min and max disagree by more than 2%
 * (a sign something is wrong). The signed `source` names which feeds counted.
 */
async function fetchBtcUsd(): Promise<{ price: number; source: string }> {
  const feeds: { name: string; fn: () => Promise<number> }[] = [
    { name: 'coinbase', fn: coinbase },
    { name: 'kraken', fn: kraken },
    { name: 'bitstamp', fn: bitstamp },
  ];
  const got: { name: string; price: number }[] = [];
  await Promise.all(
    feeds.map(async (f) => {
      try {
        const p = await f.fn();
        if (ok(p)) got.push({ name: f.name, price: p });
      } catch {
        /* drop this feed */
      }
    }),
  );
  if (got.length < 2) throw new Error('need at least two agreeing price feeds');
  const prices = got.map((g) => g.price);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  if ((hi - lo) / lo > 0.02) throw new Error('price feeds disagree too much');
  return {
    price: median(prices),
    source: got
      .map((g) => g.name)
      .sort()
      .join('+'),
  };
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
