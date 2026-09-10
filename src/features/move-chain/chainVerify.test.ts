import { describe, it, expect } from 'vitest';
import { Wallet } from 'tapit-attest';
import { verifyMoveChain, buildMoveDraftInput, moveLink } from './moveChain.ts';
import {
  buildChainVerifyUrl,
  describeChainSteps,
  parseChainProofBundle,
} from './chainVerify.ts';

// Mint a small real signed chain with a throwaway wallet: a 'start' genesis,
// then a 'sell' and a 'buy' move at given prices, mirroring the shape arena
// actually produces without depending on the arena feature.
function mintChain(w: Wallet) {
  const genesis = w.attest(
    buildMoveDraftInput({ subject: w.identity, payload: { game: 'test', kind: 'start' }, seq: 0, prevHash: '' }),
  );
  const sell = w.attest(
    buildMoveDraftInput({
      subject: w.identity,
      payload: { game: 'test', kind: 'sell', price: 70000, price_time: '2026-08-01T00:00:00.000Z' },
      seq: 1,
      prevHash: moveLink(genesis),
    }),
  );
  const buy = w.attest(
    buildMoveDraftInput({
      subject: w.identity,
      payload: { game: 'test', kind: 'buy', price: 60000, price_time: '2026-08-05T00:00:00.000Z' },
      seq: 2,
      prevHash: moveLink(sell),
    }),
  );
  return [genesis, sell, buy];
}

describe('chainVerify', () => {
  it('buildChainVerifyUrl mints a verify URL and a self-contained proof JSON', () => {
    // A whole-chain bundle carries every move's full claim + signatures (no
    // pruning, since a move has nothing sensitive to hide), so even a short
    // chain can exceed the inline-URL budget faster than a single disclosure
    // proof would — the test doesn't assume which way it lands, only that
    // both paths produce something that round-trips and verifies.
    const w = Wallet.generate();
    const chain = mintChain(w);
    const minted = buildChainVerifyUrl(chain);
    expect(minted.verifyUrl).toContain('/verify');
    if (minted.urlIsInline) expect(minted.verifyUrl).toContain('?p=');
    const bundle = parseChainProofBundle(minted.json);
    expect(bundle).not.toBeNull();
    expect(bundle!.chain.length).toBe(3);
  });

  it('parseChainProofBundle round-trips through the minted URL JSON and re-verifies', () => {
    const w = Wallet.generate();
    const chain = mintChain(w);
    const minted = buildChainVerifyUrl(chain);
    const bundle = parseChainProofBundle(minted.json)!;
    expect(verifyMoveChain(bundle.chain).valid).toBe(true);
  });

  it('parseChainProofBundle returns null for non-chain input, never throws', () => {
    expect(parseChainProofBundle('not json')).toBeNull();
    expect(parseChainProofBundle('{"v":1,"kind":"something_else"}')).toBeNull();
    expect(parseChainProofBundle('{"v":1,"kind":"move_chain"}')).toBeNull(); // missing chain array
  });

  it('describeChainSteps reports every step valid for a genuine chain', () => {
    const w = Wallet.generate();
    const chain = mintChain(w);
    const steps = describeChainSteps(chain);
    expect(steps.length).toBe(3);
    expect(steps.every((s) => s.sigValid && s.linkValid)).toBe(true);
    expect(steps.map((s) => s.kind)).toEqual(['start', 'sell', 'buy']);
    expect(steps[1]!.price).toBe(70000);
    expect(steps[2]!.price).toBe(60000);
  });

  it('describeChainSteps flags a broken link when a move is swapped out', () => {
    const w = Wallet.generate();
    const chain = mintChain(w);
    const other = Wallet.generate();
    const foreignSell = other.attest(
      buildMoveDraftInput({
        subject: other.identity,
        payload: { game: 'test', kind: 'sell', price: 99999 },
        seq: 1,
        prevHash: moveLink(chain[0]!),
      }),
    );
    const tampered = [chain[0]!, foreignSell, chain[2]!];
    const steps = describeChainSteps(tampered);
    // move 2 ('buy') still names the ORIGINAL sell's link, not foreignSell's
    expect(steps[2]!.linkValid).toBe(false);
    expect(verifyMoveChain(tampered).valid).toBe(false);
  });
});
