import { describe, it, expect } from 'vitest';
import { Wallet, type Attestation } from 'tapit-attest';
import {
  buildMoveDraftInput,
  moveLink,
  readMoveMeta,
  orderMoves,
  verifyMoveChain,
  isCleanChain,
  MOVE_ATTESTATION_KIND,
  DEFAULT_MOVE_TIER,
  type MovePayload,
} from './moveChain.ts';

// Mint a real, signed chain: each move at seq i, linked to the prior.
function mintChain(wallet: Wallet, payloads: MovePayload[]): Attestation[] {
  const chain: Attestation[] = [];
  let prev = '';
  payloads.forEach((payload, i) => {
    const att = wallet.attest(
      buildMoveDraftInput({ subject: wallet.identity, payload, seq: i, prevHash: prev }),
    );
    chain.push(att);
    prev = moveLink(att);
  });
  return chain;
}

const ARM: MovePayload = { kind: 'arm', price: 76582, usd: 1000 };
const BUY: MovePayload = { kind: 'buy', price: 70000, usd: 250 };
const SELL: MovePayload = { kind: 'sell', price: 82000, usd: 995 };

describe('buildMoveDraftInput — shape (pure)', () => {
  it('is a journal attestation at the default tier', () => {
    const d = buildMoveDraftInput({ subject: 'owner', payload: ARM, seq: 0, prevHash: '' });
    expect(d.kind).toBe(MOVE_ATTESTATION_KIND);
    expect(d.kind).toBe('journal');
    expect(d.tier).toBe(DEFAULT_MOVE_TIER);
    expect(d.subject).toBe('owner');
  });

  it('carries seq, prev, and the payload nested under move', () => {
    const d = buildMoveDraftInput({ subject: 'owner', payload: BUY, seq: 1, prevHash: 'abc' });
    const fields = d.fields as Record<string, unknown>;
    expect(fields.seq).toBe(1);
    expect(fields.prev).toBe('abc');
    expect(fields.move).toEqual(BUY);
  });
});

describe('mint + read back', () => {
  it('reads seq, prevHash, and payload back off a signed move', () => {
    const w = Wallet.generate();
    const chain = mintChain(w, [ARM, BUY]);
    const g = readMoveMeta(chain[0]!);
    expect(g).not.toBeNull();
    expect(g!.seq).toBe(0);
    expect(g!.prevHash).toBe('');
    expect(g!.payload).toEqual(ARM);
    const leg = readMoveMeta(chain[1]!);
    expect(leg!.seq).toBe(1);
    expect(leg!.prevHash).toBe(moveLink(chain[0]!));
    expect(leg!.payload).toEqual(BUY);
  });

  it('moveLink is the attestation content address (stable)', () => {
    const w = Wallet.generate();
    const g = mintChain(w, [ARM])[0]!;
    expect(moveLink(g)).toBe(moveLink(g));
    expect(moveLink(g)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('verifyMoveChain — a clean chain', () => {
  it('a single genesis move is a clean chain owned by its signer', () => {
    const w = Wallet.generate();
    const r = verifyMoveChain(mintChain(w, [ARM]));
    expect(r.valid).toBe(true);
    expect(r.length).toBe(1);
    expect(r.owner).toBe(w.identity);
    expect(r.errors).toHaveLength(0);
  });

  it('a multi-move chain verifies in order', () => {
    const w = Wallet.generate();
    const r = verifyMoveChain(mintChain(w, [ARM, BUY, SELL, BUY]));
    expect(r.valid).toBe(true);
    expect(r.length).toBe(4);
    expect(isCleanChain(mintChain(w, [ARM, BUY]))).toBe(true);
  });

  // Regression: a real device chain reported "not signed by its own subject
  // identity" on every move even though the signatures were genuine —
  // bytesToHex always lowercases a signer's pubkey, but subject/identity can
  // arrive in a different case (storage, an import), and the comparison was
  // a bare ===. Reproduced here by signing a genesis whose subject is
  // deliberately upper-cased — cryptographically the same key, same valid
  // signature, just a differently-cased hex string for the same value.
  it('still verifies when subject is a different case than the signer hex', () => {
    const w = Wallet.generate();
    const g = w.attest(
      buildMoveDraftInput({ subject: w.identity.toUpperCase(), payload: ARM, seq: 0, prevHash: '' }),
    );
    const r = verifyMoveChain([g]);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  // Regression: this is the actual live bug the case-fix above didn't
  // catch — a real device screenshot still showed "not signed by its own
  // subject identity" on every move after that fix shipped. Root cause:
  // subject/identity is the wallet's STABLE genesis key, but wallet.attest
  // always signs with the CURRENT active key, and after a rotation those
  // are two different keys. Without the owner's succession chain, a
  // genuinely valid post-rotation signature has no way to be recognized as
  // still belonging to the same owner.
  it('a move signed after rotation fails without succession, verifies with it', () => {
    const w = Wallet.generate();
    const genesis = mintChain(w, [ARM])[0]!;
    w.rotate();
    const afterRotation = w.attest(
      buildMoveDraftInput({ subject: w.identity, payload: BUY, seq: 1, prevHash: moveLink(genesis) }),
    );
    const chain = [genesis, afterRotation];
    expect(verifyMoveChain(chain).valid).toBe(false);
    const withSuccession = verifyMoveChain(chain, w.successionChain);
    expect(withSuccession.valid).toBe(true);
    expect(withSuccession.errors).toHaveLength(0);
  });

  it('resolveActiveKeys ignores a succession chain that does not start from this identity', () => {
    const w = Wallet.generate();
    const stranger = Wallet.generate();
    stranger.rotate();
    // A real, internally-valid succession chain, just for someone else's
    // identity — must never widen who counts as THIS chain's owner.
    const chain = mintChain(w, [ARM]);
    const r = verifyMoveChain(chain, stranger.successionChain);
    expect(r.valid).toBe(true); // unaffected — w never rotated
    expect(r.owner).toBe(w.identity);
  });
});

describe('verifyMoveChain — cheats and breaks', () => {
  it('empty chain is invalid', () => {
    const r = verifyMoveChain([]);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('empty chain');
  });

  it('an edited move breaks its signature and the link after it', () => {
    const w = Wallet.generate();
    const chain = mintChain(w, [ARM, BUY, SELL]);
    // Tamper with the middle move: bump its timestamp. That invalidates
    // its signature AND changes its content address, orphaning move 2.
    const tampered = [...chain];
    const target = chain[1]!;
    tampered[1] = {
      ...target,
      issuedAt: new Date(Date.parse(target.issuedAt) + 1000).toISOString(),
    };
    const r = verifyMoveChain(tampered);
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('reordering moves is caught by the seq check', () => {
    const w = Wallet.generate();
    const chain = mintChain(w, [ARM, BUY, SELL]);
    const swapped = [chain[0]!, chain[2]!, chain[1]!];
    expect(verifyMoveChain(swapped).valid).toBe(false);
  });

  it('a move from a different owner breaks the chain', () => {
    const a = Wallet.generate();
    const b = Wallet.generate();
    const g = a.attest(buildMoveDraftInput({ subject: a.identity, payload: ARM, seq: 0, prevHash: '' }));
    // b tries to append its own move onto a's chain.
    const intruder = b.attest(
      buildMoveDraftInput({ subject: b.identity, payload: BUY, seq: 1, prevHash: moveLink(g) }),
    );
    const r = verifyMoveChain([g, intruder]);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('different owner'))).toBe(true);
  });

  it('claiming someone else\'s identity as subject is rejected', () => {
    const me = Wallet.generate();
    const victim = Wallet.generate();
    // me signs a move but stamps victim's identity as the subject.
    const forged = me.attest(
      buildMoveDraftInput({ subject: victim.identity, payload: ARM, seq: 0, prevHash: '' }),
    );
    const r = verifyMoveChain([forged]);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('not signed by its own subject identity'))).toBe(true);
  });

  it('a genesis that does not start at seq 0 / empty prev is invalid', () => {
    const w = Wallet.generate();
    const bad = w.attest(buildMoveDraftInput({ subject: w.identity, payload: ARM, seq: 1, prevHash: 'x' }));
    const r = verifyMoveChain([bad]);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('genesis'))).toBe(true);
  });
});

describe('readMoveMeta / orderMoves — non-move safety', () => {
  it('a plain journal attestation is not move-shaped', () => {
    const w = Wallet.generate();
    const plain = w.attest({ kind: 'journal', tier: 'routine', subject: w.identity, fields: { note: 'hi' } });
    expect(readMoveMeta(plain)).toBeNull();
    expect(verifyMoveChain([plain]).valid).toBe(false);
  });

  it('orderMoves sorts by seq and drops non-moves', () => {
    const w = Wallet.generate();
    const chain = mintChain(w, [ARM, BUY, SELL]);
    const plain = w.attest({ kind: 'journal', tier: 'routine', subject: w.identity, fields: { note: 'x' } });
    const shuffled = [chain[2]!, plain, chain[0]!, chain[1]!];
    const ordered = orderMoves(shuffled);
    expect(ordered).toHaveLength(3);
    expect(ordered.map((a) => readMoveMeta(a)!.seq)).toEqual([0, 1, 2]);
    expect(verifyMoveChain(ordered).valid).toBe(true);
  });
});
