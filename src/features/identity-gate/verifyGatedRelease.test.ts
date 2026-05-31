import { describe, it, expect } from 'vitest';
import {
  Wallet,
  envelopeId,
  identityAttestation,
} from 'tapit-attest';
import type { Attestation } from 'tapit-attest';
import {
  buildAttestReleaseAuthorityDraft,
  buildRevokeReleaseAuthorityDraft,
} from './releaseAuthorityEnvelopes.ts';
import {
  buildReleaseGatePolicyLeafDraft,
  readReleaseGatePolicyLeaf,
} from './identityLeafCredential.ts';
import { verifyGatedRelease } from './verifyGatedRelease.ts';

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

const ONE_YEAR_FROM_NOW = new Date(
  Date.now() + 365 * 24 * 60 * 60 * 1000,
).toISOString();

function signAttest(
  attestor: { wallet: Wallet },
  identityPubkey: string,
  opts: {
    identityLeaf?: string;
    identityLeafEnvelopeId?: string;
    horizonUntil?: string;
    attestorName?: string;
  } = {},
): Attestation {
  return attestor.wallet.sign(
    buildAttestReleaseAuthorityDraft({
      identityPubkey,
      identityLeaf: opts.identityLeaf ?? 'dynasty_trust_spend_key',
      ...(opts.identityLeafEnvelopeId
        ? { identityLeafEnvelopeId: opts.identityLeafEnvelopeId }
        : {}),
      attestorName: opts.attestorName ?? 'Peer',
      horizonUntil: opts.horizonUntil ?? ONE_YEAR_FROM_NOW,
    }),
  );
}

function buildPolicyView(
  op: { wallet: Wallet; identity: Attestation },
  opts: {
    eligible: string[];
    threshold: number;
    freshnessHours?: number;
  },
) {
  const draft = buildReleaseGatePolicyLeafDraft({
    identityPubkey: op.identity.subject,
    forLeaf: 'dynasty_trust_spend_key',
    eligiblePubkeys: opts.eligible,
    threshold: opts.threshold,
    freshnessHorizonHours: opts.freshnessHours ?? 365 * 24,
  });
  const signed = op.wallet.sign(draft);
  return readReleaseGatePolicyLeaf(signed);
}

describe('verifyGatedRelease — threshold + freshness composition', () => {
  it('returns released when threshold met by fresh eligible attestations', () => {
    const op = newWalletAs('Op');
    const peerA = newWalletAs('A');
    const peerB = newWalletAs('B');
    const peerC = newWalletAs('C');
    const eligible = [
      peerA.identity.subject,
      peerB.identity.subject,
      peerC.identity.subject,
    ];
    const policy = buildPolicyView(op, { eligible, threshold: 2 });
    const result = verifyGatedRelease({
      attestations: [
        signAttest(peerA, op.identity.subject),
        signAttest(peerB, op.identity.subject),
      ],
      gatePolicy: policy,
      vouchingCirclePubkeys: eligible,
      identityPubkey: op.identity.subject,
    });
    expect(result.kind).toBe('released');
    if (result.kind === 'released') {
      expect(result.validCount).toBe(2);
      expect(result.threshold).toBe(2);
    }
  });

  it('returns threshold-not-met when valid count < threshold', () => {
    const op = newWalletAs('Op');
    const peerA = newWalletAs('A');
    const peerB = newWalletAs('B');
    const peerC = newWalletAs('C');
    const eligible = [
      peerA.identity.subject,
      peerB.identity.subject,
      peerC.identity.subject,
    ];
    const policy = buildPolicyView(op, { eligible, threshold: 3 });
    const result = verifyGatedRelease({
      attestations: [
        signAttest(peerA, op.identity.subject),
        signAttest(peerB, op.identity.subject),
      ],
      gatePolicy: policy,
      vouchingCirclePubkeys: eligible,
      identityPubkey: op.identity.subject,
    });
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') {
      expect(result.reason).toBe('threshold-not-met');
      expect(result.detail).toMatch(/2 of 3/);
    }
  });

  it('returns no-valid-attestations when zero fresh attestations exist', () => {
    const op = newWalletAs('Op');
    const peerA = newWalletAs('A');
    const policy = buildPolicyView(op, {
      eligible: [peerA.identity.subject],
      threshold: 1,
    });
    const result = verifyGatedRelease({
      attestations: [],
      gatePolicy: policy,
      vouchingCirclePubkeys: [peerA.identity.subject],
      identityPubkey: op.identity.subject,
    });
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') {
      expect(result.reason).toBe('no-valid-attestations');
    }
  });
});

describe('verifyGatedRelease — policy-eligible-set-subset-of-vouching-circle (gap 10 partial)', () => {
  it('refuses with policy-tampered when policy names a peer outside vouching circle', () => {
    const op = newWalletAs('Op');
    const designatedPeer = newWalletAs('Designated');
    const sneakedInPeer = newWalletAs('Sneaked');
    // Operator's vouching circle has only the designated peer.
    // Policy names the sneaked-in peer — tampered.
    const policy = buildPolicyView(op, {
      eligible: [designatedPeer.identity.subject, sneakedInPeer.identity.subject],
      threshold: 1,
    });
    const result = verifyGatedRelease({
      attestations: [signAttest(designatedPeer, op.identity.subject)],
      gatePolicy: policy,
      vouchingCirclePubkeys: [designatedPeer.identity.subject], // sneaked NOT in vouching
      identityPubkey: op.identity.subject,
    });
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') {
      expect(result.reason).toBe('policy-tampered');
      expect(result.detail).toMatch(/outside the operator's vouching circle/);
    }
  });

  it('accepts a policy whose eligible set is a proper subset of vouching circle', () => {
    const op = newWalletAs('Op');
    const peerA = newWalletAs('A');
    const peerB = newWalletAs('B');
    const peerC = newWalletAs('C');
    // Vouching circle is all three; policy names only A and B
    // (a proper subset — valid).
    const policy = buildPolicyView(op, {
      eligible: [peerA.identity.subject, peerB.identity.subject],
      threshold: 1,
    });
    const result = verifyGatedRelease({
      attestations: [signAttest(peerA, op.identity.subject)],
      gatePolicy: policy,
      vouchingCirclePubkeys: [
        peerA.identity.subject,
        peerB.identity.subject,
        peerC.identity.subject,
      ],
      identityPubkey: op.identity.subject,
    });
    expect(result.kind).toBe('released');
  });
});

describe('verifyGatedRelease — freshness-horizon-precedence (operator policy wins)', () => {
  it('stales an attestation when policy freshness window is tighter than horizon_until', () => {
    const op = newWalletAs('Op');
    const peerA = newWalletAs('A');
    // Attestation signed RIGHT NOW with attester's horizon_until
    // far in the future. Policy says freshness window is 1 hour.
    // Then verify with now=2 hours from now — the attestation is
    // stale per policy even though the attester said it's valid.
    const attest = signAttest(peerA, op.identity.subject);
    const policy = buildPolicyView(op, {
      eligible: [peerA.identity.subject],
      threshold: 1,
      freshnessHours: 1,
    });
    const result = verifyGatedRelease({
      attestations: [attest],
      gatePolicy: policy,
      vouchingCirclePubkeys: [peerA.identity.subject],
      identityPubkey: op.identity.subject,
      now: Date.now() + 2 * 60 * 60 * 1000, // 2 hours later
    });
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') {
      expect(result.reason).toBe('no-valid-attestations');
      expect(result.detail).toMatch(/policy freshness window: 1 hours/);
    }
  });

  it('keeps an attestation fresh when policy window comfortably covers attestation age', () => {
    const op = newWalletAs('Op');
    const peerA = newWalletAs('A');
    const attest = signAttest(peerA, op.identity.subject);
    const policy = buildPolicyView(op, {
      eligible: [peerA.identity.subject],
      threshold: 1,
      freshnessHours: 24,
    });
    const result = verifyGatedRelease({
      attestations: [attest],
      gatePolicy: policy,
      vouchingCirclePubkeys: [peerA.identity.subject],
      identityPubkey: op.identity.subject,
      now: Date.now() + 60 * 60 * 1000, // 1 hour later — within 24h window
    });
    expect(result.kind).toBe('released');
  });
});

describe('verifyGatedRelease — composes with leaf-binding from sub-cut C.3', () => {
  it('passes leaf-envelopeId binding through to underlying verifier', () => {
    const op = newWalletAs('Op');
    const peerA = newWalletAs('A');
    const currentLeafId = 'aa'.repeat(32);
    const policy = buildPolicyView(op, {
      eligible: [peerA.identity.subject],
      threshold: 1,
    });
    const bound = signAttest(peerA, op.identity.subject, {
      identityLeafEnvelopeId: currentLeafId,
    });
    const released = verifyGatedRelease({
      attestations: [bound],
      gatePolicy: policy,
      vouchingCirclePubkeys: [peerA.identity.subject],
      identityPubkey: op.identity.subject,
      currentLeafEnvelopeId: currentLeafId,
    });
    expect(released.kind).toBe('released');
    // Now verify with a different leaf envelope id — should refuse
    // because no attestation binds to the rotated leaf.
    const rotated = verifyGatedRelease({
      attestations: [bound],
      gatePolicy: policy,
      vouchingCirclePubkeys: [peerA.identity.subject],
      identityPubkey: op.identity.subject,
      currentLeafEnvelopeId: 'bb'.repeat(32),
    });
    expect(rotated.kind).toBe('refused');
  });
});

describe('verifyGatedRelease — composes with revocation from sub-cut B + E.1', () => {
  it('revoked attestations do not count toward the threshold', () => {
    const op = newWalletAs('Op');
    const peerA = newWalletAs('A');
    const peerB = newWalletAs('B');
    const eligible = [peerA.identity.subject, peerB.identity.subject];
    const policy = buildPolicyView(op, { eligible, threshold: 2 });

    const attestA = signAttest(peerA, op.identity.subject);
    const attestB = signAttest(peerB, op.identity.subject);
    // peer B revokes their attestation in-bundle
    const revokeB = peerB.wallet.sign(
      buildRevokeReleaseAuthorityDraft({
        identityPubkey: op.identity.subject,
        identityLeaf: 'dynasty_trust_spend_key',
        revokesAttestEnvelopeId: envelopeId(attestB),
      }),
    );
    const result = verifyGatedRelease({
      attestations: [attestA, attestB, revokeB],
      gatePolicy: policy,
      vouchingCirclePubkeys: eligible,
      identityPubkey: op.identity.subject,
    });
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') {
      expect(result.reason).toBe('threshold-not-met');
      expect(result.detail).toMatch(/1 of 2/);
    }
  });
});
