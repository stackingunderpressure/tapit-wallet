import { describe, it, expect } from 'vitest';
import { Wallet } from 'tapit-attest';
import { verifyMoveChain, readMoveMeta } from '../move-chain/moveChain.ts';
import { readWholeCoinMoves, simulateWholeCoin } from '../move-chain/truthScore.ts';
import {
  ARENA_GAME,
  buildGenesisDraft,
  buildSwitchDraft,
  findArenaChain,
  nextSeq,
  headLink,
  nextSide,
} from './arenaChain.ts';

// Mint a real signed arena run with a throwaway wallet: start, then the
// given sell/buy prices in order. Returns the ordered chain.
function mintRun(w: Wallet, prices: { side: 'sell' | 'buy'; price: number }[]) {
  const chain = [w.attest(buildGenesisDraft(w.identity, { charityTxid: 'tx0', stakeSats: 1000 }))];
  for (const p of prices) {
    chain.push(
      w.attest(
        buildSwitchDraft(w.identity, {
          side: p.side,
          price: p.price,
          seq: nextSeq(chain),
          prevHash: headLink(chain),
          priceSource: 'manual',
        }),
      ),
    );
  }
  return chain;
}

describe('arenaChain', () => {
  it('genesis is a seq-0 start move tagged with the game', () => {
    const w = Wallet.generate();
    const g = w.attest(buildGenesisDraft(w.identity));
    const meta = readMoveMeta(g)!;
    expect(meta.seq).toBe(0);
    expect(meta.prevHash).toBe('');
    expect(meta.payload.game).toBe(ARENA_GAME);
    expect(meta.payload.kind).toBe('start');
  });

  it('genesis carries the charity txid and stake when given', () => {
    const w = Wallet.generate();
    const g = w.attest(buildGenesisDraft(w.identity, { charityTxid: 'abc', stakeSats: 2500 }));
    const meta = readMoveMeta(g)!;
    expect(meta.payload.charity_txid).toBe('abc');
    expect(meta.payload.stake_sats).toBe(2500);
  });

  it('a switch carries side, price, and the game tag', () => {
    const w = Wallet.generate();
    const g = w.attest(buildGenesisDraft(w.identity));
    const s = w.attest(
      buildSwitchDraft(w.identity, { side: 'sell', price: 70000, seq: 1, prevHash: headLink([g]) }),
    );
    const meta = readMoveMeta(s)!;
    expect(meta.payload.game).toBe(ARENA_GAME);
    expect(meta.payload.kind).toBe('sell');
    expect(meta.payload.price).toBe(70000);
    expect(meta.seq).toBe(1);
  });

  it('a minted run is a valid, unbroken chain', () => {
    const w = Wallet.generate();
    const chain = mintRun(w, [
      { side: 'sell', price: 70000 },
      { side: 'buy', price: 35000 },
    ]);
    expect(verifyMoveChain(chain).valid).toBe(true);
    // one full round: sell at 70k, buy back at 35k -> two coins (before friction)
    const score = simulateWholeCoin(readWholeCoinMoves(chain));
    expect(score.coinsNow).toBeCloseTo(2, 5);
  });

  it('findArenaChain pulls only this game+owner from mixed holdings, ordered', () => {
    const me = Wallet.generate();
    const other = Wallet.generate();
    const chain = mintRun(me, [
      { side: 'sell', price: 70000 },
      { side: 'buy', price: 60000 },
    ]);
    // holdings arrive shuffled, and include a foreign owner's arena move
    const foreign = other.attest(buildGenesisDraft(other.identity));
    const holdings = [chain[2]!, foreign, chain[0]!, chain[1]!];
    const found = findArenaChain(holdings, me.identity);
    expect(found.map((a) => readMoveMeta(a)!.seq)).toEqual([0, 1, 2]);
    expect(found.every((a) => a.subject === me.identity)).toBe(true);
  });

  it('findArenaChain ignores non-arena moves the owner also holds', () => {
    const me = Wallet.generate();
    const chain = mintRun(me, [{ side: 'sell', price: 70000 }]);
    // a plain journal-shaped move with no game tag must not be swept in
    const stray = me.attest({
      kind: 'journal',
      tier: 'routine',
      subject: me.identity,
      fields: { seq: 0, prev: '', move: { hello: 'world' } },
    });
    const found = findArenaChain([...chain, stray], me.identity);
    expect(found.length).toBe(2);
  });

  it('nextSeq and headLink advance the chain head', () => {
    const w = Wallet.generate();
    expect(nextSeq([])).toBe(0);
    expect(headLink([])).toBe('');
    const chain = mintRun(w, [{ side: 'sell', price: 70000 }]);
    expect(nextSeq(chain)).toBe(2);
    expect(headLink(chain)).not.toBe('');
  });

  it('nextSide is sell while holding, buy while in cash', () => {
    const w = Wallet.generate();
    expect(nextSide([])).toBe('sell'); // start holding the coin
    const afterStart = mintRun(w, []);
    expect(nextSide(afterStart)).toBe('sell');
    const afterSell = mintRun(w, [{ side: 'sell', price: 70000 }]);
    expect(nextSide(afterSell)).toBe('buy');
    const afterRound = mintRun(w, [
      { side: 'sell', price: 70000 },
      { side: 'buy', price: 60000 },
    ]);
    expect(nextSide(afterRound)).toBe('sell');
  });
});
