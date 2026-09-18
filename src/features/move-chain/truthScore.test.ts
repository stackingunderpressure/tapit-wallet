import { describe, it, expect } from 'vitest';
import { Wallet, type Attestation } from 'tapit-attest';
import { buildMoveDraftInput, moveLink, verifyMoveChain, type MovePayload } from './moveChain.ts';
import {
  previewMove,
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
    expect(r.openSell).toEqual({ sellPrice: 100_000, coinsSold: 1, cashUsd: 100_000 });
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

describe('previewMove — what the button is allowed to promise', () => {
  // The operator's REAL run, read off the signed move chain he pasted
  // (chain-proof bundle, 2026-09-18, verified valid across two key rotations).
  // Not a reconstruction: these are the prices in his signed attestations.
  //
  //   seq 1  2026-09-04  sell  $79,675
  //   seq 2  2026-09-15  buy   $76,299.80
  //   seq 3  2026-09-18  sell  $80,383.20   <- still open, holding cash
  //
  // He sold at the market and it had not moved by the time of the screenshot,
  // so spot == that last sell price, and every figure below reproduces his
  // screen exactly: 1.003089 coins, +308,896 sats, $80,632.
  //
  // My first pass at this reconstructed a single sell at $82,268 from one coin.
  // He corrected it ("I sold at 80383 not 82") and he was right — the screen
  // said so twice and I read past both: "Rounds 1" means a sell->buy had
  // already completed, and a lone sell at spot from 1.0 coin can only produce
  // 0.980100 after both legs' fees.
  const R1_SELL = 79_675;
  const R1_BUY = 76_299.8;
  const OPEN_SELL = 80_383.2;
  const SPOT = OPEN_SELL;
  const F = 1;
  const moves = [sell(R1_SELL), buy(R1_BUY), sell(OPEN_SELL)];
  const inCash = simulateWholeCoin(moves, { frictionPctPerLeg: F, currentPrice: SPOT });

  it('reproduces his screen exactly from his own signed prices', () => {
    expect(inCash.rounds).toHaveLength(1); // screen: Rounds 1
    expect(inCash.holding).toBe('cash'); // screen: Holding cash
    expect(inCash.openSell!.sellPrice).toBe(OPEN_SELL);
    // Compared the way the app prints them (fmtCoins = toFixed(6), fmtUsd =
    // rounded), so these are what he actually saw, not floats near it.
    expect(inCash.openSell!.coinsSold.toFixed(6)).toBe('1.023456');
    expect(Math.round(inCash.openSell!.cashUsd)).toBe(81_446);
    expect(inCash.coinsNow.toFixed(6)).toBe('1.003089'); // screen: 1.003089
    expect(Math.round(inCash.edgeCoins * 1e8)).toBe(308_896); // screen: +308,896 sats
    expect(inCash.edgePct.toFixed(2)).toBe('0.31'); // screen: +0.31%
    expect(Math.round(inCash.minBuyBackToBeatHodl!)).toBe(80_632); // screen: $80,632
    expect(Math.round(inCash.coinsNow * SPOT)).toBe(80_632); // screen: after costs $80,632
  });

  it('a lone sell at spot could NOT have produced that screen', () => {
    // Guards the correction itself: the first reconstruction was impossible.
    const lone = simulateWholeCoin([sell(SPOT)], { frictionPctPerLeg: F, currentPrice: SPOT });
    expect(lone.coinsNow).toBeCloseTo(0.9801, 6);
    expect(lone.rounds).toHaveLength(0);
  });

  it('a buy-back deploys the WHOLE cash balance, not one coin at spot', () => {
    // The defect. The button quoted spot ($80,383) next to "Buy the whole coin
    // back", which reads as the cost of the trade. The trade actually spends
    // $81,446 — the entire balance — off by $1,063.
    const p = previewMove(inCash, SPOT, F)!;
    expect(p.kind).toBe('buy');
    expect(Math.round(p.cashUsd)).toBe(81_446);
    expect(Math.round(p.cashUsd) - Math.round(SPOT)).toBe(1_063);
  });

  it('promises exactly the coin count the scoreboard is already showing', () => {
    // The button and the headline must agree, or one of them is lying.
    const p = previewMove(inCash, SPOT, F)!;
    const actual = simulateWholeCoin([...moves, buy(SPOT)], {
      frictionPctPerLeg: F,
      currentPrice: SPOT,
    });
    expect(p.coins).toBeCloseTo(actual.coinsNow, 9);
    expect(p.coins).toBeCloseTo(inCash.coinsNow, 9);
  });

  it('crosses 1.0 exactly at the stated buy-back threshold', () => {
    const at = previewMove(inCash, inCash.minBuyBackToBeatHodl!, F)!;
    expect(at.coins).toBeCloseTo(1, 9);
    expect(previewMove(inCash, inCash.minBuyBackToBeatHodl! - 500, F)!.coins).toBeGreaterThan(1);
    expect(previewMove(inCash, inCash.minBuyBackToBeatHodl! + 500, F)!.coins).toBeLessThan(1);
  });

  it('the threshold sits ABOVE the sell price when more than a coin was sold', () => {
    // The second thing that looked like broken math: he sold at $80,383 and the
    // app said buy back below $80,631 — buy back HIGHER than you sold and still
    // win. True, because the lead carried into the sell is already banked. The
    // UI now states the coin count that makes it legible, so pin both facts.
    expect(inCash.openSell!.coinsSold).toBeGreaterThan(1);
    expect(inCash.minBuyBackToBeatHodl!).toBeGreaterThan(inCash.openSell!.sellPrice);
    // Concretely: sold at $80,383.20, may buy back up to $80,631.50.
    expect(Math.round(inCash.minBuyBackToBeatHodl!)).toBe(80_632);

    // And the opposite case still holds: from exactly one coin, fees force the
    // threshold BELOW the sell price.
    const fromOne = simulateWholeCoin([sell(OPEN_SELL)], {
      frictionPctPerLeg: F,
      currentPrice: SPOT,
    });
    expect(fromOne.openSell!.coinsSold).toBe(1);
    expect(fromOne.minBuyBackToBeatHodl!).toBeLessThan(fromOne.openSell!.sellPrice);
  });

  it('the sell leg drifts the same way once the count leaves 1.0', () => {
    // Why this was never caught: at exactly one coin the old label is roughly
    // right. After a winning round it is not — selling 1.003089 coins at
    // $80,383 nets $79,825, not $80,383.
    const inCoin = simulateWholeCoin([...moves, buy(SPOT)], {
      frictionPctPerLeg: F,
      currentPrice: SPOT,
    });
    const p = previewMove(inCoin, SPOT, F)!;
    expect(p.kind).toBe('sell');
    expect(p.coins.toFixed(6)).toBe('1.003089');
    expect(Math.round(p.cashUsd)).toBe(79_825);
    expect(Math.round(p.cashUsd)).not.toBe(SPOT);
  });

  it('a sell preview feeds straight into the next real sell', () => {
    const inCoin = simulateWholeCoin([...moves, buy(SPOT)], {
      frictionPctPerLeg: F,
      currentPrice: SPOT,
    });
    const p = previewMove(inCoin, SPOT, F)!;
    const after = simulateWholeCoin([...moves, buy(SPOT), sell(SPOT)], {
      frictionPctPerLeg: F,
      currentPrice: SPOT,
    });
    expect(p.cashUsd).toBeCloseTo(after.openSell!.cashUsd, 6);
    expect(p.coins).toBeCloseTo(after.openSell!.coinsSold, 9);
  });

  it('returns null rather than a junk number when there is no usable price', () => {
    expect(previewMove(inCash, 0, F)).toBeNull();
    expect(previewMove(inCash, -1, F)).toBeNull();
    expect(previewMove(inCash, Number.NaN, F)).toBeNull();
  });

  it('honours zero friction', () => {
    const clean = simulateWholeCoin([sell(100_000)], { frictionPctPerLeg: 0, currentPrice: 90_000 });
    const p = previewMove(clean, 90_000, 0)!;
    expect(p.cashUsd).toBeCloseTo(100_000, 6);
    expect(p.coins).toBeCloseTo(100_000 / 90_000, 9);
  });
});
