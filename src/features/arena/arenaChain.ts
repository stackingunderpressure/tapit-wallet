import type { Attestation, DraftInput } from 'tapit-attest';
import {
  buildMoveDraftInput,
  moveLink,
  orderMoves,
  readMoveMeta,
} from '../move-chain/moveChain.ts';
import { readWholeCoinMoves, simulateWholeCoin } from '../move-chain/truthScore.ts';
import type { SignedPriceRound } from './priceRound.ts';

// arenaChain — the arena-specific glue over the generic move-chain
// primitive for "Beat the HODL Machine". A run is a move chain whose
// genesis is a "start" move and whose later moves are whole-coin
// sell / buy switches. Every arena move carries a `game` tag so a
// wallet holding many kinds of attestations can pull just this game's
// moves back out of its holdings.
//
// PURE. No wallet, no network, no Date.now(). The screen supplies the
// wallet (which signs via wallet.attest) and the clock; these helpers
// only shape drafts and read a chain's current state. The honesty of
// the prices a move is stamped at is the oracle/anchor layer's job
// (see ARENA_SPEC.md) — this module only carries them.

/** The tag every arena move carries, so the run is findable in holdings. */
export const ARENA_GAME = 'beat-the-hodl' as const;

/**
 * Friction charged on EVERY leg (percent). Fixed at 2% and not user-lowerable
 * on purpose: a sell-all then buy-all-back is two legs, and each real leg pays
 * an exchange/withdrawal fee, the bid-ask spread, and slippage moving size. Two
 * percent per leg (~4% round trip) is deliberately pessimistic so the game can
 * never flatter you — if you beat the HODL ball after 2% a leg, you beat it for
 * real. Letting a player dial their own friction down would let them
 * manufacture a fake win, which defeats the whole point.
 */
export const DEFAULT_FRICTION_PCT = 2;

export interface GenesisOpts {
  /** The charity donation txid that roots the trail (optional in the prototype). */
  charityTxid?: string;
  /** The stake, in sats, sent to the charity (optional in the prototype). */
  stakeSats?: number;
}

export interface SwitchOpts {
  side: 'sell' | 'buy';
  price: number;
  seq: number;
  prevHash: string;
  /** ISO time the price was acted on. */
  priceTime?: string;
  /** where the price came from — 'manual' until the signed oracle is wired. */
  priceSource?: string;
  /**
   * The verified signed oracle round this price came from, if any. When
   * present its full fields + signature are stamped into the move so a
   * later verifier can re-check the oracle's Schnorr signature over
   * {price, time, source, round} against the oracle pubkey — the price is
   * then proven real, not just asserted.
   */
  round?: SignedPriceRound;
}

/** Shape the genesis "start" move. Hand to wallet.attest, then hold + anchor. */
export function buildGenesisDraft(subject: string, opts: GenesisOpts = {}): DraftInput {
  const payload: Record<string, string | number | boolean> = {
    game: ARENA_GAME,
    kind: 'start',
  };
  if (opts.charityTxid && opts.charityTxid.trim().length > 0) {
    payload.charity_txid = opts.charityTxid.trim();
  }
  if (typeof opts.stakeSats === 'number' && Number.isFinite(opts.stakeSats) && opts.stakeSats > 0) {
    payload.stake_sats = Math.floor(opts.stakeSats);
  }
  return buildMoveDraftInput({ subject, payload, seq: 0, prevHash: '' });
}

/** Shape one whole-coin switch (sell-all or buy-all-back). */
export function buildSwitchDraft(subject: string, o: SwitchOpts): DraftInput {
  const payload: Record<string, string | number | boolean> = {
    game: ARENA_GAME,
    kind: o.side,
    price: o.price,
  };
  if (o.priceTime) payload.price_time = o.priceTime;
  if (o.priceSource) payload.price_source = o.priceSource;
  // A verified oracle round: stamp the full signed datum so anyone can
  // re-verify the oracle's signature over the price later.
  if (o.round) {
    payload.price_source = 'oracle';
    payload.oracle_pubkey = o.round.pubkey;
    payload.oracle_sig = o.round.sig;
    payload.oracle_round = o.round.round;
    payload.oracle_time = o.round.time;
    payload.oracle_source = o.round.source;
  }
  return buildMoveDraftInput({ subject, payload, seq: o.seq, prevHash: o.prevHash });
}

/**
 * Pull this owner's arena run out of the wallet's holdings, in chain
 * order (genesis first). Filters to move-shaped attestations tagged with
 * this game and owned by this identity, then orders by seq.
 */
export function findArenaChain(
  holdings: readonly Attestation[],
  ownerId: string,
): Attestation[] {
  const mine = holdings.filter((a) => {
    if (a.subject !== ownerId) return false;
    const meta = readMoveMeta(a);
    return !!meta && meta.payload.game === ARENA_GAME;
  });
  return orderMoves(mine);
}

/** The seq a new move should take (0 for the genesis, then 1, 2, …). */
export function nextSeq(chain: readonly Attestation[]): number {
  return chain.length;
}

/** The link a new move chains on — the head move's moveLink, '' if empty. */
export function headLink(chain: readonly Attestation[]): string {
  if (chain.length === 0) return '';
  return moveLink(chain[chain.length - 1]!);
}

/**
 * The side a NEW move must take: 'sell' while holding the coin, 'buy'
 * while sitting in cash. Reuses the tested scorer's holding state so the
 * legal-move rule can never drift from the scoring rule. A run that has
 * not started (empty chain) reports 'sell' — you begin holding the coin.
 */
export function nextSide(chain: readonly Attestation[]): 'sell' | 'buy' {
  const holding = simulateWholeCoin(readWholeCoinMoves(chain)).holding;
  return holding === 'btc' ? 'sell' : 'buy';
}
