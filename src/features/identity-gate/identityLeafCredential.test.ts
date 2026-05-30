import { describe, it, expect } from 'vitest';
import {
  Wallet,
  envelopeId,
  identityAttestation,
} from 'tapit-attest';
import type { Attestation } from 'tapit-attest';
import {
  buildVouchingCircleLeafDraft,
  findLatestVouchingCircleLeaf,
  isIdentityLeaf,
  isIdentityLeafOfType,
  isVouchingCircleLeaf,
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
    // Identical issuedAt so the only variable is pubkey input order.
    const issuedAt = '2026-05-29T12:00:00.000Z';
    const draftOne = {
      ...buildVouchingCircleLeafDraft({
        identityPubkey: op.identity.subject,
        pubkeys: [peerA, peerB, peerC],
      }),
      issuedAt,
    };
    const draftTwo = {
      ...buildVouchingCircleLeafDraft({
        identityPubkey: op.identity.subject,
        pubkeys: [peerC, peerA, peerB],
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
