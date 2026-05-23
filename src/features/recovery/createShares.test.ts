import { describe, it, expect } from 'vitest';
import { Wallet, combineShares } from 'tapit-attest';
import {
  buildRecoveryShares,
  decryptHeldShare,
  isRecoveryShare,
  readRecoveryShare,
} from './createShares.ts';
import type { CohortMember } from './createCohort.ts';

// Phase 5e-iii-b-2 share-distribution round-trip: build N
// recovery-share envelopes, each NIP-44 encrypted to its
// recipient's pubkey, then decrypt each one on the recipient side
// and combine M of them back into the original K_data.

describe('buildRecoveryShares + decryptHeldShare', () => {
  it('round-trips K_data through M of N peers', () => {
    const operator = Wallet.generate();
    // Generate 5 peers.
    const peers = Array.from({ length: 5 }, () => Wallet.generate());
    const cohort: CohortMember[] = peers.map((p, i) => ({
      pubkey: p.publicKey,
      name: `Peer ${i + 1}`,
    }));
    // Original K_data (32 random bytes).
    const kData = new Uint8Array(32);
    for (let i = 0; i < 32; i++) kData[i] = (i * 17 + 3) & 0xff;

    const packages = buildRecoveryShares(operator, kData, cohort, 3);
    expect(packages).toHaveLength(5);
    for (const pkg of packages) {
      expect(isRecoveryShare(pkg.envelope)).toBe(true);
      const view = readRecoveryShare(pkg.envelope);
      expect(view.ownerId).toBe(operator.identity);
      expect(view.threshold).toBe(3);
      expect(view.totalShares).toBe(5);
      expect(view.shareCiphertext.length).toBeGreaterThan(0);
    }

    // Each peer decrypts their own share. Different peers MUST get
    // different shares back (Shamir's x-coordinate varies).
    const recoveredShares = packages.map((pkg, i) => {
      const peer = peers[i]!;
      return decryptHeldShare(peer, pkg.envelope);
    });
    // Take any 3 shares — the smallest threshold-satisfying subset.
    const reconstructed = combineShares([
      recoveredShares[0]!,
      recoveredShares[2]!,
      recoveredShares[4]!,
    ]);
    expect(reconstructed).toEqual(kData);
  });

  it('rejects a wrong peer trying to decrypt a share addressed to someone else', () => {
    const operator = Wallet.generate();
    const peerA = Wallet.generate();
    const peerB = Wallet.generate();
    const cohort: CohortMember[] = [
      { pubkey: peerA.publicKey, name: 'A' },
      { pubkey: peerB.publicKey, name: 'B' },
    ];
    const kData = new Uint8Array(32).fill(7);
    const [pkgA] = buildRecoveryShares(operator, kData, cohort, 2);
    expect(pkgA).toBeDefined();
    // Peer B trying to decrypt the share addressed to peer A throws.
    expect(() => decryptHeldShare(peerB, pkgA!.envelope)).toThrow(
      /addressed to someone else/,
    );
  });
});
