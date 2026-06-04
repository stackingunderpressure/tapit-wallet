import { describe, it, expect } from 'vitest';
import {
  splitSharedSecret,
  combineSharedSecret,
  parseShare,
} from './sharedSecret.ts';

describe('sharedSecret split/combine', () => {
  it('round-trips a secret with any threshold subset', () => {
    const shares = splitSharedSecret('open sesame', 2, 4);
    expect(shares).toHaveLength(4);
    // Any 2 of the 4 rebuild it.
    const r1 = combineSharedSecret([shares[0]!, shares[1]!]);
    expect(r1).toEqual({ ok: true, secret: 'open sesame' });
    const r2 = combineSharedSecret([shares[2]!, shares[3]!]);
    expect(r2).toEqual({ ok: true, secret: 'open sesame' });
    const r3 = combineSharedSecret([shares[0]!, shares[3]!]);
    expect(r3).toEqual({ ok: true, secret: 'open sesame' });
  });

  it('handles unicode and longer phrases', () => {
    const secret = 'Pick up Lacey — café 🔑 code 4287';
    const shares = splitSharedSecret(secret, 3, 5);
    const r = combineSharedSecret([shares[4]!, shares[1]!, shares[2]!]);
    expect(r).toEqual({ ok: true, secret });
  });

  it('refuses with fewer than the threshold', () => {
    const shares = splitSharedSecret('two of three', 3, 3);
    const r = combineSharedSecret([shares[0]!, shares[1]!]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/need 3/);
  });

  it('does not count a duplicated share twice', () => {
    const shares = splitSharedSecret('no dup', 2, 3);
    const r = combineSharedSecret([shares[0]!, shares[0]!]);
    expect(r.ok).toBe(false); // one distinct share, threshold 2
  });

  it('rejects shares from different secrets mixed together', () => {
    const a = splitSharedSecret('secret A', 2, 3);
    const b = splitSharedSecret('secret B', 2, 3);
    // One share from each — combine() runs but the magic marker won't survive.
    const r = combineSharedSecret([a[0]!, b[1]!]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/don't go together|wrong/i);
  });

  it('rejects a malformed share token', () => {
    const r = combineSharedSecret(['not-a-share']);
    expect(r.ok).toBe(false);
  });

  it('parseShare validates structure', () => {
    const [s0] = splitSharedSecret('x', 2, 2);
    expect(parseShare(s0!)).not.toBeNull();
    expect(parseShare('tapit-secret.v1.2.300.abcd')).toBeNull(); // index > 255
    expect(parseShare('tapit-secret.v1.2.1.xyz')).toBeNull(); // bad hex
    expect(parseShare('garbage')).toBeNull();
  });

  it('validates split inputs', () => {
    expect(() => splitSharedSecret('', 2, 3)).toThrow(/empty/);
    expect(() => splitSharedSecret('x', 1, 3)).toThrow(/at least 2/);
    expect(() => splitSharedSecret('x', 3, 2)).toThrow(/at least the threshold/);
  });
});
