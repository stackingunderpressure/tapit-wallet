import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalRoundString } from './priceRoundCanonical.ts';

// Signer/verifier parity guard — the same idiom as the persona contract test
// (PFOR-027), applied to the price oracle.
//
// netlify/functions/price-oracle.mts deliberately INLINES its own copy of
// roundDigest rather than importing priceRoundCanonical.ts, because Netlify's
// esbuild function bundler can choke on a ../../src import and silently ship
// a broken endpoint. That tradeoff buys deploy safety at the cost of two
// copies that must stay byte-identical.
//
// The failure mode if they drift is nasty and silent: the oracle signs a
// digest over one serialization, the browser verifies a digest over another,
// every signature fails, and every price in the game quietly reads
// 'bad_signature' — with nothing pointing at the real cause. Prose in a
// comment does not prevent that. This check does.

const here = dirname(fileURLToPath(import.meta.url));
const fnPath = join(here, '..', '..', '..', 'netlify', 'functions', 'price-oracle.mts');

describe('price-oracle function ↔ client canonical parity', () => {
  const src = readFileSync(fnPath, 'utf8');

  it('the serverless function still inlines a canonical round string', () => {
    expect(src).toContain("JSON.stringify([0, 'price-round'");
  });

  it('the function canonicalizes the exact same field order as the client', () => {
    // Pull the literal out of the function source and compare it to the
    // client's own expression, normalized for quote style and whitespace.
    const m = src.match(/JSON\.stringify\(\[0, 'price-round',([^\]]*)\]\)/);
    expect(m, 'could not find the canonical literal in price-oracle.mts').not.toBeNull();
    const fnOrder = m![1]!.replace(/\s|f\./g, '');
    expect(fnOrder).toBe('round,time,source,price');
  });

  it('a round serialized by the client matches the documented wire shape', () => {
    // Belt and braces: pin the actual bytes, so a change to either side has
    // to come past a failing assertion naming the exact string.
    expect(
      canonicalRoundString({ price: 79675, time: 1_756_900_000, source: 'coinbase', round: 42 }),
    ).toBe('[0,"price-round",42,1756900000,"coinbase",79675]');
  });

  it('the oracle secret is never read from a VITE_-prefixed variable', () => {
    // A VITE_ prefix would bake the signing key into the browser bundle,
    // handing every visitor the power to forge prices.
    expect(src).toContain('process.env.ARENA_ORACLE_PRIVATE_KEY');
    expect(src).not.toMatch(/VITE_[A-Z_]*PRIVATE/);
  });
});
