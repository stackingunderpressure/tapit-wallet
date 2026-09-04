import { readMoveMeta } from './moveChain.ts';
import type { Attestation } from 'tapit-attest';

// truthScore — "your math shows the truth". The honest scorer for the
// whole-coin, all-in-or-all-out game: you start holding one whole
// bitcoin (the HODL ball, frozen at 1.0). Your only moves are to sell
// the WHOLE coin at a price and then buy the WHOLE coin back at a price
// — sell, buy back, sell, buy back. Buy back cheaper than you sold and
// your coin count grows; buy back higher and it shrinks. HODL never
// moves; it is one coin, forever. The stamps (the signed move chain)
// prove WHEN and at WHAT price you chose; this engine proves the coin
// count those choices actually produce, after real friction on every
// switch. Nobody has to donate or stake to play or to see this number —
// the stake is only how seriously the world takes your claim, never a
// gate on the math.
//
// PURE. Deterministic. No wallet, no network, no Date.now(). Given the
// same moves it returns byte-identical output. It reads whatever prices
// the moves were stamped at — the honesty of those prices being real
// feed prices is the move-chain / broadcast layer's job, not this one's.

export type WholeCoinMoveKind = 'sell' | 'buy';

/** One whole-coin switch, in chain order. Price is the price acted on. */
export interface WholeCoinMove {
  kind: WholeCoinMoveKind;
  price: number;
}

/** A completed sell → buy-back round, scored in coins vs the HODL ball. */
export interface RoundResult {
  sellPrice: number;
  buyPrice: number;
  coinsBefore: number;
  coinsAfter: number;
  /** coinsAfter − coinsBefore: what this round added (or gave back). */
  contributionCoins: number;
}

export interface TruthResult {
  /** the HODL ball — one whole coin, frozen. */
  hodlCoins: number;
  /** your realized coin count: the coin amount while holding it, or the coins
   *  locked at the sell price (one fee paid) while in cash. Only a trade moves
   *  it — never the live price. */
  coinsNow: number;
  /** 'btc' = holding the coin; 'cash' = sold, waiting to buy back. */
  holding: 'btc' | 'cash';
  /** coinsNow − hodlCoins. Positive means you're ahead of holding. */
  edgeCoins: number;
  edgePct: number;
  /** coins given up to friction vs the same moves run frictionless. */
  frictionCoins: number;
  rounds: RoundResult[];
  /** while in cash: the price you must buy back at to get back to the
   *  HODL ball; buying back below it puts you ahead. null when in btc. */
  minBuyBackToBeatHodl: number | null;
  /** while in cash: the open sell's price and the cash it produced. */
  openSell: { sellPrice: number; cashUsd: number } | null;
  currentPrice: number;
  /** false if a move came out of turn (a sell while already in cash, or
   *  a buy while already in btc). Such a move is skipped, not applied. */
  wellFormed: boolean;
}

export interface TruthOpts {
  /** the whole-coin stake — the game is one coin, so this is 1. */
  startCoins?: number;
  /** friction charged on EVERY leg (fee + spread + slippage), percent. */
  frictionPctPerLeg?: number;
  /** price to mark "now"; defaults to the last move's price. */
  currentPrice?: number;
}

function num(x: unknown): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : 0;
}

// Replay the moves and return the final coin count. Split out so the
// friction-cost figure is an honest counterfactual: the same moves run
// with zero friction, minus the real run.
function replayCoins(
  moves: readonly WholeCoinMove[],
  startCoins: number,
  f: number,
): {
  coins: number;
  cashUsd: number;
  holding: 'btc' | 'cash';
  rounds: RoundResult[];
  openSell: { sellPrice: number; cashUsd: number } | null;
  wellFormed: boolean;
  coinsNow: number;
} {
  let holding: 'btc' | 'cash' = 'btc';
  let coins = startCoins;
  let cashUsd = 0;
  let wellFormed = true;
  const rounds: RoundResult[] = [];
  let open: { sellPrice: number; coinsBefore: number } | null = null;

  for (const move of moves) {
    const price = num(move.price);
    if (move.kind === 'sell') {
      if (holding !== 'btc' || price <= 0) {
        wellFormed = false;
        continue;
      }
      cashUsd = coins * price * (1 - f);
      open = { sellPrice: price, coinsBefore: coins };
      holding = 'cash';
    } else {
      if (holding !== 'cash' || price <= 0 || !open) {
        wellFormed = false;
        continue;
      }
      const coinsAfter = (cashUsd / price) * (1 - f);
      rounds.push({
        sellPrice: open.sellPrice,
        buyPrice: price,
        coinsBefore: open.coinsBefore,
        coinsAfter,
        contributionCoins: coinsAfter - open.coinsBefore,
      });
      coins = coinsAfter;
      cashUsd = 0;
      open = null;
      holding = 'btc';
    }
  }

  // Your coin count is your REALIZED position, and it only moves when you
  // trade — never when the live price wanders. Holding the coin, it's the coin
  // amount. Holding cash, it's the coins you locked in at the price you sold
  // at (cashUsd / sellPrice), which equals coins × (1 − f): the one fee you
  // actually paid on the sell, and nothing more. The live price does not mark
  // this to market — that truth lives in minBuyBackToBeatHodl (the price you'd
  // need to buy back at) and only becomes real coins when you actually buy.
  const coinsNow =
    holding === 'btc' ? coins : open && open.sellPrice > 0 ? cashUsd / open.sellPrice : 0;
  const openSell = holding === 'cash' && open ? { sellPrice: open.sellPrice, cashUsd } : null;
  return { coins, cashUsd, holding, rounds, openSell, wellFormed, coinsNow };
}

/**
 * Score a whole-coin game. All-in / all-out, strictly alternating
 * sell → buy-back starting from holding the coin. Coins now vs the HODL
 * ball (one coin), after friction on every leg. An out-of-turn move
 * (selling while already in cash, buying while already in the coin) is
 * skipped and flags the result not-well-formed rather than corrupting
 * the count.
 */
export function simulateWholeCoin(moves: readonly WholeCoinMove[], opts: TruthOpts = {}): TruthResult {
  const startCoins = num(opts.startCoins ?? 1) || 1;
  const f = Math.max(0, num(opts.frictionPctPerLeg)) / 100;
  const lastPrice = moves.length ? num(moves[moves.length - 1]!.price) : 0;
  const currentPrice =
    typeof opts.currentPrice === 'number' && opts.currentPrice > 0 ? opts.currentPrice : lastPrice;

  const real = replayCoins(moves, startCoins, f);
  const shadow = replayCoins(moves, startCoins, 0);

  const hodlCoins = startCoins;
  const edgeCoins = real.coinsNow - hodlCoins;
  const minBuyBackToBeatHodl =
    real.holding === 'cash' && real.openSell ? (real.openSell.cashUsd * (1 - f)) / hodlCoins : null;

  return {
    hodlCoins,
    coinsNow: real.coinsNow,
    holding: real.holding,
    edgeCoins,
    edgePct: hodlCoins > 0 ? (edgeCoins / hodlCoins) * 100 : 0,
    frictionCoins: shadow.coinsNow - real.coinsNow,
    rounds: real.rounds,
    minBuyBackToBeatHodl,
    openSell: real.openSell,
    currentPrice,
    wellFormed: real.wellFormed,
  };
}

/**
 * Bridge move-chain → the scorer: read a verified chain's sell/buy moves
 * (in order) into WholeCoinMoves. The genesis "start" move (any kind
 * that isn't sell/buy) is skipped, so a chain of start → sell → buy →
 * sell → buy yields just the switches. Verify the chain with
 * verifyMoveChain FIRST; this only reads.
 */
export function readWholeCoinMoves(chain: readonly Attestation[]): WholeCoinMove[] {
  const out: WholeCoinMove[] = [];
  for (const att of chain) {
    const meta = readMoveMeta(att);
    if (!meta) continue;
    const kind = meta.payload.kind;
    if (kind !== 'sell' && kind !== 'buy') continue;
    out.push({ kind, price: num(meta.payload.price) });
  }
  return out;
}
