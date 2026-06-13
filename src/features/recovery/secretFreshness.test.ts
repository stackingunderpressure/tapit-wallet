import { describe, it, expect } from 'vitest';
import {
  newSecretRecord,
  recordPieceReceipt,
  pieceFreshness,
  confirmedSummary,
} from './secretLedger.ts';

const WEEK = 7 * 24 * 60 * 60 * 1000;

describe('pieceFreshness', () => {
  const base = newSecretRecord({ name: 'n', why: '', total: 3, threshold: 2 });
  const now = Date.now();

  it("reads 'none' for a piece no holder has confirmed", () => {
    expect(pieceFreshness(base.pieces[0]!, now)).toBe('none');
  });

  it("reads fresh / watch / cold by age of the last confirm", () => {
    const at = (ms: number) => new Date(now - ms).toISOString();
    const fresh = recordPieceReceipt(base, 1, { status: 'held', at: at(2 * WEEK) });
    const watch = recordPieceReceipt(base, 1, { status: 'held', at: at(8 * WEEK) });
    const cold = recordPieceReceipt(base, 1, { status: 'held', at: at(12 * WEEK) });
    expect(pieceFreshness(fresh.pieces[0]!, now)).toBe('fresh');
    expect(pieceFreshness(watch.pieces[0]!, now)).toBe('watch');
    expect(pieceFreshness(cold.pieces[0]!, now)).toBe('cold');
  });

  it("a declined piece is not 'held' so reads 'none'", () => {
    const declined = recordPieceReceipt(base, 1, { status: 'declined' });
    expect(pieceFreshness(declined.pieces[0]!, now)).toBe('none');
  });
});

describe('confirmedSummary (readiness margin)', () => {
  it('counts fresh confirmed holders against the threshold', () => {
    let rec = newSecretRecord({ name: 'n', why: '', total: 3, threshold: 2 });
    rec = recordPieceReceipt(rec, 1, { status: 'held' });
    rec = recordPieceReceipt(rec, 2, { status: 'held' });
    rec = recordPieceReceipt(rec, 3, { status: 'held' });
    const s = confirmedSummary(rec);
    expect(s.confirmed).toBe(3);
    expect(s.fresh).toBe(3);
    expect(s.threshold).toBe(2);
    expect(s.margin).toBe(1);
  });

  it('a copy/QR-only secret has zero confirmed (no liveness signal)', () => {
    const rec = newSecretRecord({ name: 'n', why: '', total: 3, threshold: 2 });
    expect(confirmedSummary(rec).confirmed).toBe(0);
  });
});
