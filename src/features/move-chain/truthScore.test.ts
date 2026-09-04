import { describe, it, expect } from 'vitest';
import { Wallet, type Attestation } from 'tapit-attest';
import { buildMoveDraftInput, moveLink, verifyMoveChain, type MovePayload } from './moveChain.ts';
import {
  simulateWholeCoin,
  readWholeCoinMoves,
  type WholeCoinMove,
} from './truthScore.ts';

const sell = (price: number): WholeCoinMove => ({ kind: 'sell', price });
const buy = (price: number): WholeCoinMove => ({ kind: 'buy', price });

describe('simulateWholeCoin — the HODL ball', () => {
  it('doing nothing is exactly the HODL ball', () => {
    const r = simulateWholeCoin([], { currentPrice: 100_000 });
    expect(r.hodlCoins).toBe(1);
    expect(r.coinsNow).toBe(1);
    expect(r.edgeCoins).toBe(0);
    expect(r.holding).toBe('btc');
    expect(r.wellFormed).toBe(true);
  });

  it('sell high, buy back lower — coin count grows', () => {
    const r = simulateWholeCoin([sell(100_000), buy(50_000)]);
    expect(r.coinsNow).toBeCloseTo(2, 10);
    expect(r.edgeCoins).toBeCloseTo(1, 10);
    expect(r.holding).toBe('btc');
    expect(r.rounds).toHaveLength(1);
    expect(r.rounds[0]!.contributionCoins).toBeCloseTo(1, 10);
  });

  it('sell then buy back HIGHER — coin count shrinks below the ball', () => {
    const r = simulateWholeCoin([sell(100_000), buy(125_000)]);
    expect(r.coinsNow).toBeCloseTo(0.8, 10);
    expect(r.edgeCoins).toBeCloseTo(-0.2, 10);
  });

  it('the carried-to-the-top run: two good round trips = four coins', () => {
    const r = simulateWholeCoin([sell(100_000), buy(50_000), sell(80_000), buy(40_000)]);
    expect(r.coinsNow).toBeCloseTo(4, 10);
    expect(r.edgeCoins).toBeCloseTo(3, 10);
    expect(r.rounds).toHaveLength(2);
  });
});

describe('simulateWholeCoin — friction is real and visible', () => {
  it('charges friction on every leg and reports coins lost to it', () => {
    const r = simulateWholeCoin([sell(100_000), buy(50_000)], { frictionPctPerLeg: 1 });
    // 1 * 100k * .99 = 99000 cash; 99000/50k * .99 = 1.9602 coins
    expect(r.coinsNow).toBeCloseTo(1.9602, 6);
    expect(r.frictionCoins).toBeCloseTo(2 - 1.9602, 6); // vs the frictionless 2.0
    expect(r.frictionCoins).toBeGreaterThan(0);
  });
});

describe('simulateWholeCoin — an open sell (holding cash)', () => {
  it('marks cash to the live buying power at the current price', () => {
    const r = simulateWholeCoin([sell(100_000)], { currentPrice: 90_000 });
    expect(r.holding).toBe('cash');
    expect(r.openSell).toEqual({ sellPrice: 100_000, cashUsd: 100_000 });
    // No friction here: cash of 100k buys 100000/90000 = 1.111 coins at the
    // live 90k price — the price dipped, so buying power rose above 1.0.
    expect(r.coinsNow).toBeCloseTo(1.1111, 4);
    // must buy back below 100k to beat the ball (no friction here)
    expect(r.minBuyBackToBeatHodl).toBeCloseTo(100_000, 6);
  });

  it('when the price runs up against you (you are down) your total sats fall', () => {
    // The operator's model: holding cash, if the price rises you lose the
    // ability to buy back as many sats, so your buying power (coinsNow) drops.
    const atSell = simulateWholeCoin([sell(80_000)], {
      frictionPctPerLeg: 1,
      currentPrice: 80_000,
    });
    expect(atSell.holding).toBe('cash');
    // Realizable buying power shows BOTH fees: (1 - f) on the sell that made
    // the cash, and (1 - f) again to buy back right now — ~0.9801 at par, the
    // honest full-round-trip figure you could actually walk away with.
    expect(atSell.coinsNow).toBeCloseTo(0.9801, 4);

    const priceUp = simulateWholeCoin([sell(80_000)], {
      frictionPctPerLeg: 1,
      currentPrice: 120_000,
    });
    const priceDown = simulateWholeCoin([sell(80_000)], {
      frictionPctPerLeg: 1,
      currentPrice: 50_000,
    });
    // Down (price up) → fewer sats than at par; the dip → more.
    expect(priceUp.coinsNow).toBeLessThan(atSell.coinsNow);
    expect(priceDown.coinsNow).toBeGreaterThan(atSell.coinsNow);
    // And the edge tracks it: behind when up, ahead when the price dipped.
    expect(priceUp.edgeCoins).toBeLessThan(0);
    expect(priceDown.edgeCoins).toBeGreaterThan(0);
  });

  it('the beat-HODL threshold accounts for friction', () => {
    const r = simulateWholeCoin([sell(100_000)], { frictionPctPerLeg: 1, currentPrice: 100_000 });
    // cash = 99000; buying back at P gives (99000/P)*.99 = 1 at P = 98010
    expect(r.minBuyBackToBeatHodl).toBeCloseTo(98_010, 4);
    expect(r.minBuyBackToBeatHodl!).toBeLessThan(100_000);
  });
});

describe('simulateWholeCoin — whole-coin, in-or-out discipline', () => {
  it('a first move that is a buy is out of turn and skipped', () => {
    const r = simulateWholeCoin([buy(50_000)]);
    expect(r.wellFormed).toBe(false);
    expect(r.coinsNow).toBe(1);
    expect(r.holding).toBe('btc');
  });

  it('two sells in a row: the second is skipped, chain flagged', () => {
    const r = simulateWholeCoin([sell(100_000), sell(90_000)], { currentPrice: 90_000 });
    expect(r.wellFormed).toBe(false);
    expect(r.holding).toBe('cash');
    expect(r.openSell!.sellPrice).toBe(100_000); // still the first sell
  });

  it('a clean alternating chain is well formed', () => {
    const r = simulateWholeCoin([sell(100_000), buy(60_000), sell(90_000), buy(70_000)]);
    expect(r.wellFormed).toBe(true);
    expect(r.rounds).toHaveLength(2);
  });
});

describe('readWholeCoinMoves — bridge from a signed chain', () => {
  it('reads the sell/buy moves off a verified chain, skipping the start', () => {
    const w = Wallet.generate();
    const payloads: MovePayload[] = [
      { kind: 'start', price: 76_582 },
      { kind: 'sell', price: 100_000 },
      { kind: 'buy', price: 50_000 },
    ];
    const chain: Attestation[] = [];
    let prev = '';
    payloads.forEach((payload, seq) => {
      const att = w.attest(buildMoveDraftInput({ subject: w.identity, payload, seq, prevHash: prev }));
      chain.push(att);
      prev = moveLink(att);
    });
    // The chain itself is a clean, verifiable move chain...
    expect(verifyMoveChain(chain).valid).toBe(true);
    // ...and the scorer reads just the switches, skipping the start.
    const moves = readWholeCoinMoves(chain);
    expect(moves).toEqual([
      { kind: 'sell', price: 100_000 },
      { kind: 'buy', price: 50_000 },
    ]);
    expect(simulateWholeCoin(moves).coinsNow).toBeCloseTo(2, 10);
  });
});
