import { describe, it, expect } from 'vitest';
import {
  newSecretRecord,
  handedOutCount,
  assignPiece,
  setWhy,
  setTokens,
  hashToken,
  tokenHashes,
  pieceIndexForToken,
  upsertRecord,
  removeRecord,
} from './secretLedger.ts';

describe('secret ledger', () => {
  it('builds a record with one pending piece per total', () => {
    const rec = newSecretRecord({ name: 'Wi-Fi', why: 'house', total: 4, threshold: 2 });
    expect(rec.pieces).toHaveLength(4);
    expect(rec.pieces.map((p) => p.index)).toEqual([1, 2, 3, 4]);
    expect(rec.pieces.every((p) => p.method === undefined)).toBe(true);
    expect(handedOutCount(rec)).toBe(0);
    expect(rec.name).toBe('Wi-Fi');
    expect(rec.id).toBeTruthy();
  });

  it('assigns a piece immutably and counts it handed out', () => {
    const rec = newSecretRecord({ name: '', why: '', total: 3, threshold: 2 });
    const next = assignPiece(rec, 2, { holderName: 'Mom', method: 'chat' });
    expect(rec.pieces[1]?.method).toBeUndefined(); // original untouched
    const p2 = next.pieces.find((p) => p.index === 2);
    expect(p2?.holderName).toBe('Mom');
    expect(p2?.method).toBe('chat');
    expect(p2?.handedAt).toBeTruthy();
    expect(handedOutCount(next)).toBe(1);
  });

  it('defaults method to "other" when only a name is given', () => {
    const rec = newSecretRecord({ name: '', why: '', total: 2, threshold: 2 });
    const next = assignPiece(rec, 1, { holderName: 'Dad' });
    expect(next.pieces.find((p) => p.index === 1)?.method).toBe('other');
  });

  it('clears an assignment when given an empty patch', () => {
    let rec = newSecretRecord({ name: '', why: '', total: 2, threshold: 2 });
    rec = assignPiece(rec, 1, { holderName: 'Dad', method: 'copy' });
    rec = assignPiece(rec, 1, {});
    expect(rec.pieces.find((p) => p.index === 1)?.method).toBeUndefined();
    expect(handedOutCount(rec)).toBe(0);
  });

  it('ignores an out-of-range index', () => {
    const rec = newSecretRecord({ name: '', why: '', total: 2, threshold: 2 });
    expect(assignPiece(rec, 9, { holderName: 'x' })).toBe(rec);
  });

  it('setTokens keeps a copy and clears it (opt-in), immutably', () => {
    const rec = newSecretRecord({ name: 'k', why: '', total: 3, threshold: 2 });
    expect(rec.tokens).toBeUndefined(); // default: nothing stored
    const kept = setTokens(rec, ['a', 'b', 'c']);
    expect(kept.tokens).toEqual(['a', 'b', 'c']);
    expect(rec.tokens).toBeUndefined(); // original untouched
    // empty / undefined clears it back to absent
    expect(setTokens(kept, undefined).tokens).toBeUndefined();
    expect(setTokens(kept, []).tokens).toBeUndefined();
  });

  it('hashToken is deterministic, trimmed, and 64-hex', () => {
    const h = hashToken('tapit-secret.v1.2.1.abcd');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken('  tapit-secret.v1.2.1.abcd  ')).toBe(h); // trims
    expect(hashToken('other')).not.toBe(h);
  });

  it('pieceIndexForToken verifies a returned piece by hash', () => {
    const tokens = ['piece-1', 'piece-2', 'piece-3'];
    const rec = { ...newSecretRecord({ name: '', why: '', total: 3, threshold: 2 }), hashes: tokenHashes(tokens) };
    expect(pieceIndexForToken(rec, 'piece-2')).toBe(2);
    expect(pieceIndexForToken(rec, 'piece-1')).toBe(1);
    expect(pieceIndexForToken(rec, 'not-a-real-piece')).toBeNull();
    // older record with no hashes → null
    const old = newSecretRecord({ name: '', why: '', total: 2, threshold: 2 });
    expect(pieceIndexForToken(old, 'piece-1')).toBeNull();
  });

  it('setWhy / upsert / remove work immutably', () => {
    const a = newSecretRecord({ name: 'A', why: '', total: 2, threshold: 2 });
    const a2 = setWhy(a, '  for the cabin  ');
    expect(a2.why).toBe('for the cabin');
    const list = upsertRecord([], a2);
    expect(list).toHaveLength(1);
    // upsert replaces by id, newest first
    const a3 = setWhy(a2, 'changed');
    const list2 = upsertRecord(list, a3);
    expect(list2).toHaveLength(1);
    expect(list2[0]?.why).toBe('changed');
    expect(removeRecord(list2, a.id)).toHaveLength(0);
  });
});
