import { describe, it, expect } from 'vitest';
import { Wallet, verifyEnvelope } from 'tapit-attest';
import { mergeSignatures } from '../cosigning/mergeSignatures.ts';
import {
  buildRecoverySuccession,
  countPeerSignatures,
  hasReachedThreshold,
  isRecoverySuccession,
  readRecoverySuccession,
} from './createRecoverySuccession.ts';

// Phase 5e-vii library proof. The peer-witnessed recovery-succession
// credential rides on the existing signEnvelope-is-idempotent +
// mergeSignatures primitives — no new protocol shapes. These tests
// pin three properties:
//
//   1. The envelope's shape is correct (predicate matches, leaves
//      parse back into a usable view).
//   2. The M-of-N math works end-to-end: restored wallet builds +
//      self-signs, each cohort peer adds their signature, the
//      initiator merges, the resulting envelope verifies as a whole
//      and surfaces the right peer-signature count.
//   3. Stranger signatures don't count toward threshold even if the
//      math accepts them — only signatures from declared cohort
//      members count as witnesses.

describe('Phase 5e-vii recovery-succession', () => {
  it('builds a credential with the right shape', () => {
    const restored = Wallet.generate();
    const peer1 = Wallet.generate();
    const peer2 = Wallet.generate();
    const peer3 = Wallet.generate();
    const cohort = [peer1.publicKey, peer2.publicKey, peer3.publicKey];

    const succession = buildRecoverySuccession(restored, cohort);

    expect(isRecoverySuccession(succession)).toBe(true);
    const view = readRecoverySuccession(succession);
    expect(view.identity).toBe(restored.identity);
    expect(view.previousKey).toBe(restored.publicKey);
    expect(view.newKey).toBe(restored.publicKey);
    expect(view.recoveredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(view.cohort.sort()).toEqual([...cohort].sort());
    // First signature is from the restored wallet — self-attestation.
    expect(succession.signatures).toHaveLength(1);
    expect(succession.signatures[0]?.signer).toBe(restored.identity);
    expect(verifyEnvelope(succession).valid).toBe(true);
  });

  it('M-of-N peer signatures accumulate via mergeSignatures', () => {
    // Simulates the post-recovery ceremony: the restored wallet ships
    // the succession draft to each cohort peer; each peer adds its
    // signature via the existing wallet.sign() (idempotent per
    // signer); the initiator absorbs each return via mergeSignatures
    // until threshold M is reached.
    const restored = Wallet.generate();
    const peer1 = Wallet.generate();
    const peer2 = Wallet.generate();
    const peer3 = Wallet.generate();
    const peer4 = Wallet.generate();
    const cohort = [peer1, peer2, peer3, peer4].map((w) => w.publicKey);

    let current = buildRecoverySuccession(restored, cohort);
    expect(countPeerSignatures(current)).toBe(0);

    // Two peers respond (in any order). Each adds its signature to
    // its own copy and returns the now-2-sig envelope; initiator
    // merges. With threshold M=2, this should reach threshold.
    const peer1Signed = peer1.sign(current);
    const merge1 = mergeSignatures(current, peer1Signed);
    current = merge1.merged;
    expect(countPeerSignatures(current)).toBe(1);
    expect(hasReachedThreshold(current, 2)).toBe(false);

    const peer3Signed = peer3.sign(current);
    const merge2 = mergeSignatures(current, peer3Signed);
    current = merge2.merged;
    expect(countPeerSignatures(current)).toBe(2);
    expect(hasReachedThreshold(current, 2)).toBe(true);

    // The merged envelope still verifies as a whole.
    expect(verifyEnvelope(current).valid).toBe(true);
    expect(current.signatures).toHaveLength(3); // restored + peer1 + peer3
  });

  it('rejects a duplicate signature from the same peer', () => {
    // Idempotency: a peer who somehow re-signs (resend, replay) does
    // not double-count. mergeSignatures dedupes by (signer, sig).
    const restored = Wallet.generate();
    const peer1 = Wallet.generate();
    const cohort = [peer1.publicKey];

    let current = buildRecoverySuccession(restored, cohort);
    const signed = peer1.sign(current);
    current = mergeSignatures(current, signed).merged;
    expect(countPeerSignatures(current)).toBe(1);

    // Re-merge the same response — should be idempotent, no change.
    const merged2 = mergeSignatures(current, signed);
    expect(merged2.newSignatures).toHaveLength(0);
    expect(countPeerSignatures(merged2.merged)).toBe(1);
  });

  it('does not count signatures from non-cohort signers', () => {
    // A signature from outside the declared cohort verifies
    // cryptographically (sign math is sign math) but does NOT count
    // toward threshold — peer-witnessed means witnesses the operator
    // declared at cohort-creation, not strangers who happened to sign.
    const restored = Wallet.generate();
    const peer1 = Wallet.generate();
    const stranger = Wallet.generate();
    const cohort = [peer1.publicKey];

    let current = buildRecoverySuccession(restored, cohort);
    const peerSigned = peer1.sign(current);
    current = mergeSignatures(current, peerSigned).merged;
    const strangerSigned = stranger.sign(current);
    current = mergeSignatures(current, strangerSigned).merged;

    // Three signatures total (restored + peer + stranger); only the
    // peer counts toward threshold.
    expect(current.signatures).toHaveLength(3);
    expect(countPeerSignatures(current)).toBe(1);
    expect(hasReachedThreshold(current, 1)).toBe(true);
    expect(hasReachedThreshold(current, 2)).toBe(false);
  });

  it('normalizes cohort pubkeys (lowercase, deduplicated, sorted)', () => {
    const restored = Wallet.generate();
    const a = '0a'.repeat(32);
    const b = 'FF'.repeat(32);
    const succession = buildRecoverySuccession(restored, [
      b,
      a,
      a, // duplicate
      b.toUpperCase(), // case-fold dupe
    ]);
    const view = readRecoverySuccession(succession);
    expect(view.cohort).toEqual([a.toLowerCase(), b.toLowerCase()]);
  });
});
