import { describe, it, expect } from 'vitest';
import { generateKeypair } from 'tapit-attest';
import { canonicalRoundString, type PriceRoundFields } from './priceRoundCanonical.ts';
import { signPriceRound, verifyPriceRound } from './priceRound.ts';

const FIELDS: PriceRoundFields = {
  price: 63251.5,
  time: 1_756_900_000,
  source: 'coinbase',
  round: 1_756_900_000,
};

describe('priceRound', () => {
  it('canonical string is fixed-order, namespaced, whitespace-free', () => {
    expect(canonicalRoundString(FIELDS)).toBe(
      '[0,"price-round",1756900000,1756900000,"coinbase",63251.5]',
    );
  });

  it('a signed round verifies against its own pubkey', () => {
    const kp = generateKeypair();
    const signed = signPriceRound(FIELDS, kp.privateKey);
    expect(signed.pubkey).toBe(kp.publicKey);
    expect(verifyPriceRound(signed)).toBe(true);
    expect(verifyPriceRound(signed, kp.publicKey)).toBe(true);
  });

  it('rejects a round from a different oracle than expected', () => {
    const kp = generateKeypair();
    const other = generateKeypair();
    const signed = signPriceRound(FIELDS, kp.privateKey);
    expect(verifyPriceRound(signed, other.publicKey)).toBe(false);
  });

  it('rejects a tampered price', () => {
    const kp = generateKeypair();
    const signed = signPriceRound(FIELDS, kp.privateKey);
    expect(verifyPriceRound({ ...signed, price: 99999 })).toBe(false);
  });

  it('rejects a tampered time, source, or round', () => {
    const kp = generateKeypair();
    const signed = signPriceRound(FIELDS, kp.privateKey);
    expect(verifyPriceRound({ ...signed, time: signed.time + 1 })).toBe(false);
    expect(verifyPriceRound({ ...signed, source: 'kraken' })).toBe(false);
    expect(verifyPriceRound({ ...signed, round: signed.round + 1 })).toBe(false);
  });

  it('rejects non-positive or non-finite prices and junk input', () => {
    const kp = generateKeypair();
    const signed = signPriceRound(FIELDS, kp.privateKey);
    expect(verifyPriceRound({ ...signed, price: 0 })).toBe(false);
    expect(verifyPriceRound({ ...signed, price: Number.NaN })).toBe(false);
    // a wrong-but-well-formed signature never passes
    expect(verifyPriceRound({ ...signed, sig: 'ab'.repeat(32) })).toBe(false);
  });
});
