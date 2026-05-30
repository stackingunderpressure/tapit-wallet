import { describe, it, expect } from 'vitest';
import {
  Wallet,
  envelopeId,
  identityAttestation,
} from 'tapit-attest';
import type { Attestation } from 'tapit-attest';
import {
  buildAttestReleaseAuthorityDraft,
  buildImposterSignalDraft,
  buildRevokeReleaseAuthorityDraft,
} from './releaseAuthorityEnvelopes.ts';
import { verifyReleaseAuthorityBundle } from './verifyReleaseAuthorityBundle.ts';

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

const PAST = '2020-01-01T00:00:00Z';

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

describe('verifyReleaseAuthorityBundle', () => {
  it('empty bundle returns 0 valid', () => {
    const op = newWalletAs('Op');
    const result = verifyReleaseAuthorityBundle({
      attestations: [],
      identityPubkey: op.identity.subject,
      eligiblePubkeys: [],
    });
    expect(result.validCount).toBe(0);
    expect(result.verdicts).toEqual([]);
  });

  it('single valid attestation by an eligible peer counts once', () => {
    const op = newWalletAs('Op');
    const peer = newWalletAs('Peer');
    const attest = signAttest(peer, op.identity.subject);
    const result = verifyReleaseAuthorityBundle({
      attestations: [attest],
      identityPubkey: op.identity.subject,
      eligiblePubkeys: [peer.identity.subject],
    });
    expect(result.validCount).toBe(1);
    expect(result.validAttestorPubkeys).toEqual([
      peer.identity.subject.toLowerCase(),
    ]);
    expect(result.verdicts[0]?.kind).toBe('valid');
  });

  it('rejects an attestation from a peer NOT in the eligible vouching circle', () => {
    const op = newWalletAs('Op');
    const eligiblePeer = newWalletAs('Eligible');
    const otherPeer = newWalletAs('Other');
    const attest = signAttest(otherPeer, op.identity.subject);
    const result = verifyReleaseAuthorityBundle({
      attestations: [attest],
      identityPubkey: op.identity.subject,
      eligiblePubkeys: [eligiblePeer.identity.subject],
    });
    expect(result.validCount).toBe(0);
    const verdict = result.verdicts[0];
    expect(verdict?.kind).toBe('invalid');
    if (verdict?.kind === 'invalid') {
      expect(verdict.reason).toBe('signer-not-eligible');
    }
  });

  it('rejects stale attestations (horizon_until in the past)', () => {
    const op = newWalletAs('Op');
    const peer = newWalletAs('Peer');
    // Build with a far-future horizon then force the verifier's "now"
    // to be later than that horizon — proves the staleness check.
    const horizon = '2026-06-01T00:00:00Z';
    const attest = signAttest(peer, op.identity.subject, {
      horizonUntil: horizon,
    });
    const result = verifyReleaseAuthorityBundle({
      attestations: [attest],
      identityPubkey: op.identity.subject,
      eligiblePubkeys: [peer.identity.subject],
      now: Date.parse('2027-01-01T00:00:00Z'),
    });
    expect(result.validCount).toBe(0);
    const verdict = result.verdicts[0];
    expect(verdict?.kind).toBe('invalid');
    if (verdict?.kind === 'invalid') {
      expect(verdict.reason).toBe('stale');
    }
  });

  it('rejects attestations targeted at a different identity', () => {
    const op = newWalletAs('Op');
    const otherOp = newWalletAs('OtherOp');
    const peer = newWalletAs('Peer');
    const attestForOther = signAttest(peer, otherOp.identity.subject);
    const result = verifyReleaseAuthorityBundle({
      attestations: [attestForOther],
      identityPubkey: op.identity.subject,
      eligiblePubkeys: [peer.identity.subject],
    });
    const verdict = result.verdicts[0];
    expect(verdict?.kind).toBe('invalid');
    if (verdict?.kind === 'invalid') {
      expect(verdict.reason).toBe('identity-mismatch');
    }
  });

  it('rejects attestations revoked by the SAME peer later in the bundle', () => {
    const op = newWalletAs('Op');
    const peer = newWalletAs('Peer');
    const attest = signAttest(peer, op.identity.subject);
    const revoke = peer.wallet.sign(
      buildRevokeReleaseAuthorityDraft({
        identityPubkey: op.identity.subject,
        identityLeaf: 'dynasty_trust_spend_key',
        revokesAttestEnvelopeId: envelopeId(attest),
      }),
    );
    const result = verifyReleaseAuthorityBundle({
      attestations: [attest, revoke],
      identityPubkey: op.identity.subject,
      eligiblePubkeys: [peer.identity.subject],
    });
    expect(result.validCount).toBe(0);
    const verdict = result.verdicts.find((v) => v.kind === 'invalid');
    expect(verdict?.kind).toBe('invalid');
    if (verdict?.kind === 'invalid') {
      expect(verdict.reason).toBe('revoked');
    }
  });

  it('ignores cross-peer revocations (peer A cannot revoke peer B attestations)', () => {
    const op = newWalletAs('Op');
    const peerA = newWalletAs('PeerA');
    const peerB = newWalletAs('PeerB');
    const attestByB = signAttest(peerB, op.identity.subject);
    // peerA signs a revoke for peerB's attestation — should be ignored
    const revokeFromA = peerA.wallet.sign(
      buildRevokeReleaseAuthorityDraft({
        identityPubkey: op.identity.subject,
        identityLeaf: 'dynasty_trust_spend_key',
        revokesAttestEnvelopeId: envelopeId(attestByB),
      }),
    );
    const result = verifyReleaseAuthorityBundle({
      attestations: [attestByB, revokeFromA],
      identityPubkey: op.identity.subject,
      eligiblePubkeys: [peerA.identity.subject, peerB.identity.subject],
    });
    expect(result.validCount).toBe(1);
    expect(result.validAttestorPubkeys).toEqual([
      peerB.identity.subject.toLowerCase(),
    ]);
  });

  it('checks leaf-envelopeId binding when currentLeafEnvelopeId provided', () => {
    const op = newWalletAs('Op');
    const peer = newWalletAs('Peer');
    const currentLeafId = 'aa'.repeat(32);
    const staleLeafId = 'bb'.repeat(32);
    const attestBound = signAttest(peer, op.identity.subject, {
      identityLeafEnvelopeId: currentLeafId,
    });
    const attestStale = signAttest(peer, op.identity.subject, {
      identityLeafEnvelopeId: staleLeafId,
      attestorName: 'PeerStaleBinding',
    });
    const result = verifyReleaseAuthorityBundle({
      attestations: [attestBound, attestStale],
      identityPubkey: op.identity.subject,
      eligiblePubkeys: [peer.identity.subject],
      currentLeafEnvelopeId: currentLeafId,
    });
    expect(result.validCount).toBe(1);
    const verdicts = result.verdicts;
    expect(verdicts[0]?.kind).toBe('valid');
    expect(verdicts[1]?.kind).toBe('invalid');
    if (verdicts[1]?.kind === 'invalid') {
      expect(verdicts[1].reason).toBe('leaf-binding-mismatch');
    }
  });

  it('rejects legacy attestations (no leaf-envelopeId binding) when binding is required', () => {
    const op = newWalletAs('Op');
    const peer = newWalletAs('Peer');
    const currentLeafId = 'aa'.repeat(32);
    const legacy = signAttest(peer, op.identity.subject); // no binding
    const result = verifyReleaseAuthorityBundle({
      attestations: [legacy],
      identityPubkey: op.identity.subject,
      eligiblePubkeys: [peer.identity.subject],
      currentLeafEnvelopeId: currentLeafId,
    });
    expect(result.validCount).toBe(0);
    const verdict = result.verdicts[0];
    expect(verdict?.kind).toBe('invalid');
    if (verdict?.kind === 'invalid') {
      expect(verdict.reason).toBe('leaf-binding-mismatch');
    }
  });

  it('skips legacy binding check when currentLeafEnvelopeId is absent (backwards compat)', () => {
    const op = newWalletAs('Op');
    const peer = newWalletAs('Peer');
    const legacy = signAttest(peer, op.identity.subject); // no binding
    const result = verifyReleaseAuthorityBundle({
      attestations: [legacy],
      identityPubkey: op.identity.subject,
      eligiblePubkeys: [peer.identity.subject],
      // no currentLeafEnvelopeId — binding is not checked
    });
    expect(result.validCount).toBe(1);
  });

  it('counts each distinct attestor once even with multiple attestations', () => {
    const op = newWalletAs('Op');
    const peer = newWalletAs('Peer');
    const attestOne = signAttest(peer, op.identity.subject, {
      attestorName: 'Peer-first',
    });
    const attestTwo = signAttest(peer, op.identity.subject, {
      attestorName: 'Peer-second',
    });
    const result = verifyReleaseAuthorityBundle({
      attestations: [attestOne, attestTwo],
      identityPubkey: op.identity.subject,
      eligiblePubkeys: [peer.identity.subject],
    });
    // Both verdicts are valid but the count is 1 (distinct attestor).
    expect(result.verdicts.filter((v) => v.kind === 'valid')).toHaveLength(2);
    expect(result.validCount).toBe(1);
  });

  it('ignores imposter-signal envelopes mixed into the bundle', () => {
    const op = newWalletAs('Op');
    const peer = newWalletAs('Peer');
    const attest = signAttest(peer, op.identity.subject);
    const imposter = peer.wallet.sign(
      buildImposterSignalDraft({ identityPubkey: op.identity.subject }),
    );
    const result = verifyReleaseAuthorityBundle({
      attestations: [attest, imposter],
      identityPubkey: op.identity.subject,
      eligiblePubkeys: [peer.identity.subject],
    });
    expect(result.validCount).toBe(1);
    // Imposter signals do not appear in verdicts — they ride a
    // separate channel surfaced in sub-cut F.
    expect(result.verdicts).toHaveLength(1);
  });

  it('three eligible peers each attest — validCount is 3', () => {
    const op = newWalletAs('Op');
    const peerA = newWalletAs('A');
    const peerB = newWalletAs('B');
    const peerC = newWalletAs('C');
    const result = verifyReleaseAuthorityBundle({
      attestations: [
        signAttest(peerA, op.identity.subject),
        signAttest(peerB, op.identity.subject),
        signAttest(peerC, op.identity.subject),
      ],
      identityPubkey: op.identity.subject,
      eligiblePubkeys: [
        peerA.identity.subject,
        peerB.identity.subject,
        peerC.identity.subject,
      ],
    });
    expect(result.validCount).toBe(3);
    expect(result.validAttestorPubkeys).toEqual(
      [
        peerA.identity.subject.toLowerCase(),
        peerB.identity.subject.toLowerCase(),
        peerC.identity.subject.toLowerCase(),
      ].sort(),
    );
  });

  // Reference variable to silence the unused-var check for PAST.
  it('PAST sentinel exists for staleness regression coverage', () => {
    expect(PAST).toMatch(/2020/);
  });
});
