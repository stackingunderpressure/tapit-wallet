import { describe, it, expect } from 'vitest';
import { Wallet, type Attestation, type Anchor } from 'tapit-attest';
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

  // Regression: mirrors moveChain.test.ts's case-mismatch regression — this
  // function re-derives the same signer-vs-subject check purely for display,
  // and had the same bare === bug.
  it('describeChainSteps still reports sigValid when subject is a different case than the signer hex', () => {
    const w = Wallet.generate();
    const g = w.attest(
      buildMoveDraftInput({
        subject: w.identity.toUpperCase(),
        payload: { game: 'test', kind: 'start' },
        seq: 0,
        prevHash: '',
      }),
    );
    const steps = describeChainSteps([g]);
    expect(steps[0]!.sigValid).toBe(true);
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

  // An anchored move's anchor.proof is an opaque OTS hex blob that commonly
  // dwarfs everything else about the move — carrying it by default in a
  // share link is what produced the wall-of-hex dump the operator flagged
  // ("This is the share now"). Anchors are stripped unless explicitly opted
  // into, and the strip must be truthfully flagged, never silently implied
  // as "not anchored."
  function withFakeAnchor(att: Attestation): Attestation {
    const anchor: Anchor = {
      provider: 'test-ots',
      digest: 'ab'.repeat(32),
      proof: 'cd'.repeat(400), // stand-in for a realistically large OTS blob
      status: 'confirmed',
      stampedAt: '2026-08-01T00:00:00.000Z',
      confirmedAt: '2026-08-01T01:00:00.000Z',
      btcHeight: 900000,
    };
    return { ...att, anchor };
  }

  it('buildChainVerifyUrl strips anchors by default and flags it in the bundle', () => {
    const w = Wallet.generate();
    const chain = mintChain(w).map(withFakeAnchor);
    const minted = buildChainVerifyUrl(chain);
    expect(minted.anchorsIncluded).toBe(false);
    const bundle = parseChainProofBundle(minted.json)!;
    expect(bundle.anchorsIncluded).toBe(false);
    expect(bundle.chain.every((att) => !att.anchor)).toBe(true);
    // stripping the (large) anchor blobs keeps the default bundle far
    // smaller than the same chain with anchors included
    const withAnchors = buildChainVerifyUrl(chain, { includeAnchors: true });
    expect(minted.json.length).toBeLessThan(withAnchors.json.length);
  });

  it('buildChainVerifyUrl keeps anchors when explicitly opted in', () => {
    const w = Wallet.generate();
    const chain = mintChain(w).map(withFakeAnchor);
    const minted = buildChainVerifyUrl(chain, { includeAnchors: true });
    expect(minted.anchorsIncluded).toBe(true);
    const bundle = parseChainProofBundle(minted.json)!;
    expect(bundle.chain.every((att) => att.anchor?.status === 'confirmed')).toBe(true);
    // the chain still verifies — anchor data is extra, not load-bearing
    expect(verifyMoveChain(bundle.chain).valid).toBe(true);
  });

  it('describeChainSteps distinguishes "not included in this proof" from "genuinely not anchored"', () => {
    const w = Wallet.generate();
    const anchoredChain = mintChain(w).map(withFakeAnchor);
    // anchorsIncluded=false (the stripped case): even though these moves
    // WERE anchored, a stripped bundle must never claim "not yet anchored".
    const stripped = anchoredChain.map((att) => {
      const { anchor: _anchor, ...rest } = att;
      return rest as Attestation;
    });
    expect(describeChainSteps(stripped, { anchorsIncluded: false }).every((s) => s.anchor === 'not_included')).toBe(
      true,
    );
    // anchorsIncluded=true and the anchor genuinely present: reads its real status.
    expect(describeChainSteps(anchoredChain, { anchorsIncluded: true }).every((s) => s.anchor === 'confirmed')).toBe(
      true,
    );
    // anchorsIncluded=true but genuinely never anchored: honestly "none", not "not_included".
    const neverAnchored = mintChain(Wallet.generate());
    expect(describeChainSteps(neverAnchored, { anchorsIncluded: true }).every((s) => s.anchor === 'none')).toBe(true);
  });

  // Regression: the real live bug — a chain with a move signed after a
  // key rotation reads as unsigned without the owner's succession chain,
  // and correctly as signed once it's included, mirroring
  // moveChain.test.ts's verifyMoveChain regression for this same function.
  it('describeChainSteps flags sigValid false without succession, true with it, after a rotation', () => {
    const w = Wallet.generate();
    const genesis = w.attest(
      buildMoveDraftInput({ subject: w.identity, payload: { game: 'test', kind: 'start' }, seq: 0, prevHash: '' }),
    );
    w.rotate();
    const afterRotation = w.attest(
      buildMoveDraftInput({
        subject: w.identity,
        payload: { game: 'test', kind: 'sell', price: 70000 },
        seq: 1,
        prevHash: moveLink(genesis),
      }),
    );
    const chain = [genesis, afterRotation];
    expect(describeChainSteps(chain)[1]!.sigValid).toBe(false);
    expect(describeChainSteps(chain, { succession: w.successionChain })[1]!.sigValid).toBe(true);
  });

  // The options object is named rather than positional BECAUSE the old
  // (chain, anchorsIncluded, succession) shape let a caller swap the last two
  // and get "every signature invalid" on a chain that is perfectly fine — the
  // same symptom this file has already been fixed for twice. tsc catches the
  // swap in typed callers; this guard catches it in an untyped one, because
  // silently reporting a good chain as forged is the worst thing this
  // function can do.
  it('refuses the OLD positional call shape instead of silently lying', () => {
    const w = Wallet.generate();
    const chain = mintChain(w);
    // @ts-expect-error — deliberately the retired positional shape.
    expect(() => describeChainSteps(chain, w.successionChain)).toThrow(TypeError);
    // @ts-expect-error — and the retired boolean flag.
    expect(() => describeChainSteps(chain, false)).toThrow(TypeError);
    // The named shape is unaffected.
    expect(() => describeChainSteps(chain, { anchorsIncluded: false })).not.toThrow();
    expect(() => describeChainSteps(chain)).not.toThrow();
  });

  it('buildChainVerifyUrl round-trips a succession chain so a stranger verifier honors a rotation', () => {
    const w = Wallet.generate();
    const genesis = w.attest(
      buildMoveDraftInput({ subject: w.identity, payload: { game: 'test', kind: 'start' }, seq: 0, prevHash: '' }),
    );
    w.rotate();
    const afterRotation = w.attest(
      buildMoveDraftInput({
        subject: w.identity,
        payload: { game: 'test', kind: 'sell', price: 70000 },
        seq: 1,
        prevHash: moveLink(genesis),
      }),
    );
    const chain = [genesis, afterRotation];
    const minted = buildChainVerifyUrl(chain, { succession: w.successionChain });
    const bundle = parseChainProofBundle(minted.json)!;
    expect(bundle.succession.length).toBe(1);
    expect(verifyMoveChain(bundle.chain, bundle.succession).valid).toBe(true);
  });
});
