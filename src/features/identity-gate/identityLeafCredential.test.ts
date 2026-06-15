import { describe, it, expect } from 'vitest';
import {
  Wallet,
  envelopeId,
  identityAttestation,
} from 'tapit-attest';
import type { Attestation } from 'tapit-attest';
import {
  buildReleaseGatePolicyLeafDraft,
  buildVouchingCircleLeafDraft,
  findLatestReleaseGatePolicyLeaf,
  findLatestVouchingCircleLeaf,
  isIdentityLeaf,
  isIdentityLeafOfType,
  isReleaseGatePolicyLeaf,
  isVouchingCircleLeaf,
  listEffectiveReleaseGatePolicies,
  readReleaseGatePolicyLeaf,
  readVouchingCircleLeaf,
} from './identityLeafCredential.ts';
import {
  buildAttestReleaseAuthorityDraft,
} from './releaseAuthorityEnvelopes.ts';

function newWalletAs(name: string): { wallet: Wallet; identity: Attestation } {
  const wallet = Wallet.generate();
  const identity = wallet.sign(
    identityAttestation({
      subject: wallet.publicKey,
      tier: 'notable',
      fields: { display_name: name },
    }),
  );
  return { wallet, identity };
}

const HEX_64 = (label: string) => label.padEnd(64, '0').slice(0, 64);

describe('vouching_circle leaf', () => {
  it('builds, signs, and round-trips a vouching-circle leaf', () => {
    const op = newWalletAs('Operator');
    const peer1 = HEX_64('aa');
    const peer2 = HEX_64('bb');
    const draft = buildVouchingCircleLeafDraft({
      identityPubkey: op.identity.subject,
      pubkeys: [peer1, peer2],
    });
    const signed = op.wallet.sign(draft);
    expect(isVouchingCircleLeaf(signed)).toBe(true);
    const view = readVouchingCircleLeaf(signed);
    expect(view.pubkeys).toEqual([peer1, peer2].sort());
    expect(view.designatedAt).toBeTruthy();
    expect(view.supersedes).toBe('');
  });

  it('canonicalizes pubkeys — case-insensitive dedup + sorted', () => {
    const op = newWalletAs('Op');
    const peerA = HEX_64('aa');
    const peerB = HEX_64('bb');
    const draft = buildVouchingCircleLeafDraft({
      identityPubkey: op.identity.subject,
      // input order: B, A, A-uppercase (dup), B (dup)
      pubkeys: [peerB, peerA, peerA.toUpperCase(), peerB],
    });
    const signed = op.wallet.sign(draft);
    const view = readVouchingCircleLeaf(signed);
    expect(view.pubkeys).toEqual([peerA, peerB]);
  });

  it('canonicalization makes two equal-content leaves produce the SAME envelopeId', () => {
    // The envelopeId IS the leaf's cryptographic commitment per
    // the sub-cut C.1 design. Canonicalization (sorted, deduped,
    // lowercase) ensures that the SAME logical selection always
    // produces the SAME commitment regardless of input order.
    const op = newWalletAs('Op');
    const peerA = HEX_64('aa');
    const peerB = HEX_64('bb');
    const peerC = HEX_64('cc');
    // Identical issuedAt AND designatedAt so the only variable is the
    // pubkey input order. designated_at is a wall-clock leaf inside the
    // claim; pinning it is what makes this assert canonicalization
    // rather than flake when two builds straddle a millisecond.
    const issuedAt = '2026-05-29T12:00:00.000Z';
    const designatedAt = '2026-05-29T12:00:00.000Z';
    const draftOne = {
      ...buildVouchingCircleLeafDraft({
        identityPubkey: op.identity.subject,
        pubkeys: [peerA, peerB, peerC],
        designatedAt,
      }),
      issuedAt,
    };
    const draftTwo = {
      ...buildVouchingCircleLeafDraft({
        identityPubkey: op.identity.subject,
        pubkeys: [peerC, peerA, peerB],
        designatedAt,
      }),
      issuedAt,
    };
    expect(envelopeId(draftOne)).toBe(envelopeId(draftTwo));
  });

  it('rejects malformed pubkey hex', () => {
    const op = newWalletAs('Op');
    expect(() =>
      buildVouchingCircleLeafDraft({
        identityPubkey: op.identity.subject,
        pubkeys: ['not-hex'],
      }),
    ).toThrow(/64-char hex/);
  });

  it('rejects malformed identityPubkey', () => {
    expect(() =>
      buildVouchingCircleLeafDraft({
        identityPubkey: 'not-hex',
        pubkeys: [HEX_64('aa')],
      }),
    ).toThrow(/identityPubkey must be 64-char hex/);
  });

  it('supports an empty vouching circle (operator un-designates all)', () => {
    // Operator can sign an empty vouching circle to explicitly
    // withdraw all designations — the leaf still exists for
    // audit but the gate substrate reads an empty eligible set.
    const op = newWalletAs('Op');
    const draft = buildVouchingCircleLeafDraft({
      identityPubkey: op.identity.subject,
      pubkeys: [],
    });
    const signed = op.wallet.sign(draft);
    expect(readVouchingCircleLeaf(signed).pubkeys).toEqual([]);
  });

  it('supersedes field carries through to the read view', () => {
    const op = newWalletAs('Op');
    const priorEnvelopeId = 'aa'.repeat(32);
    const draft = buildVouchingCircleLeafDraft({
      identityPubkey: op.identity.subject,
      pubkeys: [HEX_64('aa')],
      supersedes: priorEnvelopeId,
    });
    const signed = op.wallet.sign(draft);
    expect(readVouchingCircleLeaf(signed).supersedes).toBe(priorEnvelopeId);
  });

  it('tolerates a corrupt payload (returns empty pubkeys)', () => {
    // Defensive: a malformed payload should not crash the
    // reader, it should return empty pubkeys so the operator
    // can re-sign a fresh leaf to recover.
    const op = newWalletAs('Op');
    const draft = buildVouchingCircleLeafDraft({
      identityPubkey: op.identity.subject,
      pubkeys: [HEX_64('aa')],
    });
    const signed = op.wallet.sign(draft);
    // Surgically replace the payload leaf with invalid JSON.
    const corrupted: Attestation = {
      ...signed,
      claim: {
        ...signed.claim,
        children: signed.claim.children.map((c) =>
          c.name === 'payload'
            ? { ...c, value: '{not json' }
            : c,
        ),
      },
    };
    expect(readVouchingCircleLeaf(corrupted).pubkeys).toEqual([]);
  });
});

describe('isIdentityLeaf typeguards', () => {
  it('isIdentityLeaf returns true for a vouching-circle leaf', () => {
    const op = newWalletAs('Op');
    const draft = buildVouchingCircleLeafDraft({
      identityPubkey: op.identity.subject,
      pubkeys: [HEX_64('aa')],
    });
    expect(isIdentityLeaf(draft)).toBe(true);
    expect(isIdentityLeafOfType(draft, 'vouching_circle')).toBe(true);
    expect(isIdentityLeafOfType(draft, 'bitcoin_spending_key')).toBe(false);
  });

  it('isIdentityLeaf returns false for the identity attestation itself', () => {
    const op = newWalletAs('Op');
    expect(isIdentityLeaf(op.identity)).toBe(false);
    expect(isVouchingCircleLeaf(op.identity)).toBe(false);
  });

  it('isIdentityLeaf returns false for unrelated credentials', () => {
    const op = newWalletAs('Op');
    const peer = newWalletAs('Peer');
    const ONE_YEAR_FROM_NOW = new Date(
      Date.now() + 365 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const attest = peer.wallet.sign(
      buildAttestReleaseAuthorityDraft({
        identityPubkey: op.identity.subject,
        identityLeaf: 'dynasty_trust_spend_key',
        attestorName: 'Peer',
        horizonUntil: ONE_YEAR_FROM_NOW,
      }),
    );
    expect(isIdentityLeaf(attest)).toBe(false);
  });
});

describe('findLatestVouchingCircleLeaf', () => {
  it('returns null when no leaves exist', () => {
    const op = newWalletAs('Op');
    expect(findLatestVouchingCircleLeaf([], op.identity.subject)).toBeNull();
  });

  it('returns the only leaf when one exists', () => {
    const op = newWalletAs('Op');
    const leaf = op.wallet.sign(
      buildVouchingCircleLeafDraft({
        identityPubkey: op.identity.subject,
        pubkeys: [HEX_64('aa')],
      }),
    );
    const found = findLatestVouchingCircleLeaf([leaf], op.identity.subject);
    expect(found?.issuedAt).toBe(leaf.issuedAt);
  });

  it('returns the latest-by-issuedAt when multiple exist', () => {
    const op = newWalletAs('Op');
    const older = op.wallet.sign({
      ...buildVouchingCircleLeafDraft({
        identityPubkey: op.identity.subject,
        pubkeys: [HEX_64('aa')],
      }),
      issuedAt: '2026-05-01T12:00:00.000Z',
    });
    const newer = op.wallet.sign({
      ...buildVouchingCircleLeafDraft({
        identityPubkey: op.identity.subject,
        pubkeys: [HEX_64('bb')],
      }),
      issuedAt: '2026-05-29T12:00:00.000Z',
    });
    // Insert in reverse-chronological order to prove the helper
    // doesn't just take "last in the list."
    const found = findLatestVouchingCircleLeaf(
      [newer, older],
      op.identity.subject,
    );
    expect(found?.issuedAt).toBe(newer.issuedAt);
    expect(readVouchingCircleLeaf(found!).pubkeys).toEqual([HEX_64('bb')]);
  });

  it('ignores leaves signed by a different wallet', () => {
    const op = newWalletAs('Op');
    const other = newWalletAs('Other');
    const otherLeaf = other.wallet.sign(
      buildVouchingCircleLeafDraft({
        identityPubkey: other.identity.subject,
        pubkeys: [HEX_64('aa')],
      }),
    );
    expect(
      findLatestVouchingCircleLeaf([otherLeaf], op.identity.subject),
    ).toBeNull();
  });
});

describe('release_gate_policy leaf', () => {
  it('builds, signs, and round-trips a gate policy', () => {
    const op = newWalletAs('Op');
    const draft = buildReleaseGatePolicyLeafDraft({
      identityPubkey: op.identity.subject,
      forLeaf: 'dynasty_trust_spend_key',
      eligiblePubkeys: [HEX_64('aa'), HEX_64('bb'), HEX_64('cc')],
      threshold: 2,
      freshnessHorizonHours: 30 * 24,
    });
    const signed = op.wallet.sign(draft);
    expect(isReleaseGatePolicyLeaf(signed)).toBe(true);
    const view = readReleaseGatePolicyLeaf(signed);
    expect(view.forLeaf).toBe('dynasty_trust_spend_key');
    expect(view.eligiblePubkeys).toEqual([
      HEX_64('aa'),
      HEX_64('bb'),
      HEX_64('cc'),
    ]);
    expect(view.threshold).toBe(2);
    expect(view.freshnessHorizonHours).toBe(30 * 24);
    expect(view.pingHorizonHours).toBeNull();
  });

  it('defaults freshness_horizon_hours to one year (8760 hours)', () => {
    const op = newWalletAs('Op');
    const draft = buildReleaseGatePolicyLeafDraft({
      identityPubkey: op.identity.subject,
      forLeaf: 'foo',
      eligiblePubkeys: [HEX_64('aa')],
      threshold: 1,
    });
    const signed = op.wallet.sign(draft);
    expect(readReleaseGatePolicyLeaf(signed).freshnessHorizonHours).toBe(8760);
  });

  it('round-trips an optional ping_horizon_hours', () => {
    const op = newWalletAs('Op');
    const draft = buildReleaseGatePolicyLeafDraft({
      identityPubkey: op.identity.subject,
      forLeaf: 'foo',
      eligiblePubkeys: [HEX_64('aa')],
      threshold: 1,
      pingHorizonHours: 24,
    });
    const signed = op.wallet.sign(draft);
    expect(readReleaseGatePolicyLeaf(signed).pingHorizonHours).toBe(24);
  });

  it('canonicalizes eligible_pubkeys — sorted + deduped + lowercase', () => {
    const op = newWalletAs('Op');
    const a = HEX_64('aa');
    const b = HEX_64('bb');
    const draft = buildReleaseGatePolicyLeafDraft({
      identityPubkey: op.identity.subject,
      forLeaf: 'foo',
      eligiblePubkeys: [b, a, a.toUpperCase(), b],
      threshold: 1,
    });
    const signed = op.wallet.sign(draft);
    expect(readReleaseGatePolicyLeaf(signed).eligiblePubkeys).toEqual([a, b]);
  });

  it('rejects empty forLeaf', () => {
    const op = newWalletAs('Op');
    expect(() =>
      buildReleaseGatePolicyLeafDraft({
        identityPubkey: op.identity.subject,
        forLeaf: '   ',
        eligiblePubkeys: [HEX_64('aa')],
        threshold: 1,
      }),
    ).toThrow(/forLeaf must not be empty/);
  });

  it('rejects threshold larger than eligible set size', () => {
    const op = newWalletAs('Op');
    expect(() =>
      buildReleaseGatePolicyLeafDraft({
        identityPubkey: op.identity.subject,
        forLeaf: 'foo',
        eligiblePubkeys: [HEX_64('aa'), HEX_64('bb')],
        threshold: 5,
      }),
    ).toThrow(/threshold 5 cannot exceed eligible set size 2/);
  });

  it('rejects threshold less than 1', () => {
    const op = newWalletAs('Op');
    expect(() =>
      buildReleaseGatePolicyLeafDraft({
        identityPubkey: op.identity.subject,
        forLeaf: 'foo',
        eligiblePubkeys: [HEX_64('aa')],
        threshold: 0,
      }),
    ).toThrow(/threshold must be a positive integer/);
  });

  it('isReleaseGatePolicyLeaf does not match vouching_circle', () => {
    const op = newWalletAs('Op');
    const vouching = buildVouchingCircleLeafDraft({
      identityPubkey: op.identity.subject,
      pubkeys: [HEX_64('aa')],
    });
    expect(isReleaseGatePolicyLeaf(vouching)).toBe(false);
  });

  it('isIdentityLeaf returns true for release_gate_policy', () => {
    const op = newWalletAs('Op');
    const policy = buildReleaseGatePolicyLeafDraft({
      identityPubkey: op.identity.subject,
      forLeaf: 'foo',
      eligiblePubkeys: [HEX_64('aa')],
      threshold: 1,
    });
    expect(isIdentityLeaf(policy)).toBe(true);
    expect(isIdentityLeafOfType(policy, 'release_gate_policy')).toBe(true);
  });
});

describe('findLatestReleaseGatePolicyLeaf', () => {
  it('returns null when no policy exists for the named leaf', () => {
    const op = newWalletAs('Op');
    expect(
      findLatestReleaseGatePolicyLeaf([], op.identity.subject, 'foo'),
    ).toBeNull();
  });

  it('returns the policy for the matching forLeaf only', () => {
    const op = newWalletAs('Op');
    const policyForA = op.wallet.sign(
      buildReleaseGatePolicyLeafDraft({
        identityPubkey: op.identity.subject,
        forLeaf: 'leaf_a',
        eligiblePubkeys: [HEX_64('aa')],
        threshold: 1,
      }),
    );
    const policyForB = op.wallet.sign(
      buildReleaseGatePolicyLeafDraft({
        identityPubkey: op.identity.subject,
        forLeaf: 'leaf_b',
        eligiblePubkeys: [HEX_64('bb')],
        threshold: 1,
      }),
    );
    const foundA = findLatestReleaseGatePolicyLeaf(
      [policyForA, policyForB],
      op.identity.subject,
      'leaf_a',
    );
    expect(foundA?.issuedAt).toBe(policyForA.issuedAt);
    const foundB = findLatestReleaseGatePolicyLeaf(
      [policyForA, policyForB],
      op.identity.subject,
      'leaf_b',
    );
    expect(foundB?.issuedAt).toBe(policyForB.issuedAt);
  });

  it('latest-by-issuedAt wins per forLeaf', () => {
    const op = newWalletAs('Op');
    const older = op.wallet.sign({
      ...buildReleaseGatePolicyLeafDraft({
        identityPubkey: op.identity.subject,
        forLeaf: 'foo',
        eligiblePubkeys: [HEX_64('aa')],
        threshold: 1,
      }),
      issuedAt: '2026-05-01T12:00:00.000Z',
    });
    const newer = op.wallet.sign({
      ...buildReleaseGatePolicyLeafDraft({
        identityPubkey: op.identity.subject,
        forLeaf: 'foo',
        eligiblePubkeys: [HEX_64('bb'), HEX_64('cc')],
        threshold: 2,
      }),
      issuedAt: '2026-05-29T12:00:00.000Z',
    });
    const found = findLatestReleaseGatePolicyLeaf(
      [newer, older],
      op.identity.subject,
      'foo',
    );
    expect(found?.issuedAt).toBe(newer.issuedAt);
    expect(readReleaseGatePolicyLeaf(found!).threshold).toBe(2);
  });
});

describe('listEffectiveReleaseGatePolicies (item 11 D0)', () => {
  function policy(op: { wallet: Wallet; identity: Attestation }, forLeaf: string, threshold: number, issuedAt: string): Attestation {
    return op.wallet.sign({
      ...buildReleaseGatePolicyLeafDraft({
        identityPubkey: op.identity.subject,
        forLeaf,
        eligiblePubkeys: [HEX_64('aa'), HEX_64('bb'), HEX_64('cc')],
        threshold,
      }),
      issuedAt,
    });
  }

  it('returns one effective policy per distinct leaf', () => {
    const op = newWalletAs('Operator');
    const a = policy(op, 'spend_key', 2, '2026-06-01T00:00:00.000Z');
    const b = policy(op, 'recovery_share', 1, '2026-06-01T00:00:00.000Z');
    const list = listEffectiveReleaseGatePolicies([a, b], op.wallet.identity);
    expect(list.length).toBe(2);
    const leaves = list.map((p) => readReleaseGatePolicyLeaf(p).forLeaf).sort();
    expect(leaves).toEqual(['recovery_share', 'spend_key']);
  });

  it('keeps only the latest policy per leaf (supersession)', () => {
    const op = newWalletAs('Operator');
    const older = policy(op, 'spend_key', 2, '2026-06-01T00:00:00.000Z');
    const newer = policy(op, 'spend_key', 3, '2026-06-02T00:00:00.000Z');
    const list = listEffectiveReleaseGatePolicies([older, newer], op.wallet.identity);
    expect(list.length).toBe(1);
    expect(readReleaseGatePolicyLeaf(list[0]!).threshold).toBe(3);
  });

  it('ignores policies signed by someone else', () => {
    const op = newWalletAs('Operator');
    const other = newWalletAs('Impostor');
    const mine = policy(op, 'spend_key', 2, '2026-06-01T00:00:00.000Z');
    const theirs = policy(other, 'spend_key', 2, '2026-06-01T00:00:00.000Z');
    const list = listEffectiveReleaseGatePolicies([mine, theirs], op.wallet.identity);
    expect(list.length).toBe(1);
  });

  it('returns empty when there are no policies', () => {
    const op = newWalletAs('Operator');
    expect(listEffectiveReleaseGatePolicies([op.identity], op.wallet.identity)).toEqual([]);
  });
});
