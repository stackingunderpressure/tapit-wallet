import { describe, it, expect } from 'vitest';
import { Wallet, identityAttestation } from 'tapit-attest';
import type { Attestation } from 'tapit-attest';
import {
  buildVouchingCircleLeafDraft,
  buildReleaseGatePolicyLeafDraft,
} from './identityLeafCredential.ts';
import { buildAttestReleaseAuthorityDraft } from './releaseAuthorityEnvelopes.ts';
import {
  buildGatedReleaseBundle,
  verifyGatedReleaseBundle,
} from './gatedReleaseBundle.ts';
import { envelopeId } from 'tapit-attest';

function newWallet(name: string): { wallet: Wallet; identity: Attestation } {
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

const LEAF = 'bitcoin_spending_authority';
const FUTURE = () => new Date(Date.now() + 365 * 86_400_000).toISOString();

// Build a fully-resolved operator holdings set: vouching circle of 3 peers,
// a 2-of-3 gate policy, and 2 valid attestations.
function resolvedScenario() {
  const op = newWallet('Operator');
  const p1 = newWallet('Peer1');
  const p2 = newWallet('Peer2');
  const p3 = newWallet('Peer3');
  const circle = [p1.wallet.identity, p2.wallet.identity, p3.wallet.identity];

  const vouchingCircle = op.wallet.sign(
    buildVouchingCircleLeafDraft({ identityPubkey: op.wallet.identity, pubkeys: circle }),
  );
  const policy = op.wallet.sign(
    buildReleaseGatePolicyLeafDraft({
      identityPubkey: op.wallet.identity,
      forLeaf: LEAF,
      eligiblePubkeys: circle,
      threshold: 2,
    }),
  );
  const policyId = envelopeId(policy);
  const attest = (peer: { wallet: Wallet }, who: string) =>
    peer.wallet.sign(
      buildAttestReleaseAuthorityDraft({
        identityPubkey: op.wallet.identity,
        identityLeaf: LEAF,
        identityLeafEnvelopeId: policyId,
        attestorName: who,
        horizonUntil: FUTURE(),
      }),
    );
  const holdings: Attestation[] = [
    op.identity,
    vouchingCircle,
    policy,
    attest(p1, 'Peer1'),
    attest(p2, 'Peer2'),
  ];
  return { op, p1, p2, p3, holdings, policy };
}

describe('gatedReleaseBundle (item 11 D4)', () => {
  it('builds a bundle from a resolved gate', () => {
    const s = resolvedScenario();
    const bundle = buildGatedReleaseBundle(s.holdings, s.op.wallet.identity, LEAF);
    expect(bundle).not.toBeNull();
    expect(bundle!.forLeaf).toBe(LEAF);
    expect(bundle!.attestations.length).toBe(2);
  });

  it('returns null when there is no policy or vouching circle', () => {
    const op = newWallet('Lonely');
    expect(buildGatedReleaseBundle([op.identity], op.wallet.identity, LEAF)).toBeNull();
  });

  it('a stranger verifies a resolved bundle as released', () => {
    const s = resolvedScenario();
    const bundle = buildGatedReleaseBundle(s.holdings, s.op.wallet.identity, LEAF)!;
    const verdict = verifyGatedReleaseBundle(bundle);
    expect(verdict.kind).toBe('released');
    if (verdict.kind === 'released') {
      expect(verdict.validCount).toBe(2);
      expect(verdict.threshold).toBe(2);
    }
  });

  it('refuses when the threshold is not met', () => {
    const s = resolvedScenario();
    // Drop one attestation → only 1 of 2.
    const holdings = s.holdings.slice(0, 4);
    const bundle = buildGatedReleaseBundle(holdings, s.op.wallet.identity, LEAF)!;
    const verdict = verifyGatedReleaseBundle(bundle);
    expect(verdict.kind).toBe('refused');
  });

  it('REJECTS a forged policy not signed by the identity (stranger-side security)', () => {
    const s = resolvedScenario();
    const attacker = newWallet('Attacker');
    const bundle = buildGatedReleaseBundle(s.holdings, s.op.wallet.identity, LEAF)!;
    // Swap in a policy the ATTACKER signed naming their own keys.
    const forgedPolicy = attacker.wallet.sign(
      buildReleaseGatePolicyLeafDraft({
        identityPubkey: s.op.wallet.identity,
        forLeaf: LEAF,
        eligiblePubkeys: [attacker.wallet.identity],
        threshold: 1,
      }),
    );
    const tampered = { ...bundle, policy: forgedPolicy };
    const verdict = verifyGatedReleaseBundle(tampered);
    expect(verdict.kind).toBe('refused');
    if (verdict.kind === 'refused') {
      expect(verdict.reason).toBe('malformed-bundle');
    }
  });

  it('REJECTS a forged vouching circle not signed by the identity', () => {
    const s = resolvedScenario();
    const attacker = newWallet('Attacker');
    const bundle = buildGatedReleaseBundle(s.holdings, s.op.wallet.identity, LEAF)!;
    const forgedCircle = attacker.wallet.sign(
      buildVouchingCircleLeafDraft({
        identityPubkey: s.op.wallet.identity,
        pubkeys: [attacker.wallet.identity],
      }),
    );
    const tampered = { ...bundle, vouchingCircle: forgedCircle };
    const verdict = verifyGatedReleaseBundle(tampered);
    expect(verdict.kind).toBe('refused');
    if (verdict.kind === 'refused') {
      expect(verdict.reason).toBe('malformed-bundle');
    }
  });
});
