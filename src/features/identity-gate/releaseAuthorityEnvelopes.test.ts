import { describe, it, expect } from 'vitest';
import { Wallet, identityAttestation } from 'tapit-attest';
import type { Attestation } from 'tapit-attest';
import {
  buildAttestReleaseAuthorityDraft,
  buildImposterSignalDraft,
  buildRevokeReleaseAuthorityDraft,
  isAttestReleaseAuthority,
  isImposterSignal,
  isRevokeReleaseAuthority,
  readAttestReleaseAuthority,
  readImposterSignal,
  readRevokeReleaseAuthority,
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

const ONE_YEAR_FROM_NOW = new Date(
  Date.now() + 365 * 24 * 60 * 60 * 1000,
).toISOString();

describe('attest-release-authority', () => {
  it('builds, signs, and round-trips a release-authority attestation', () => {
    const operator = newWalletAs('Operator');
    const peer = newWalletAs('Peer');
    const draft = buildAttestReleaseAuthorityDraft({
      identityPubkey: operator.identity.subject,
      identityLeaf: 'dynasty_trust_spend_key',
      attestorName: 'Peer',
      horizonUntil: ONE_YEAR_FROM_NOW,
      reason: 'I have known the operator for ten years.',
    });
    const signed = peer.wallet.sign(draft);
    expect(isAttestReleaseAuthority(signed)).toBe(true);
    const view = readAttestReleaseAuthority(signed);
    expect(view.identityPubkey).toBe(
      operator.identity.subject.toLowerCase(),
    );
    expect(view.identityLeaf).toBe('dynasty_trust_spend_key');
    expect(view.attestorName).toBe('Peer');
    expect(view.horizonUntil).toBe(ONE_YEAR_FROM_NOW);
    expect(view.reason).toBe('I have known the operator for ten years.');
  });

  it('rejects invalid pubkey input', () => {
    expect(() =>
      buildAttestReleaseAuthorityDraft({
        identityPubkey: 'not-hex',
        identityLeaf: 'foo',
        attestorName: 'Peer',
        horizonUntil: ONE_YEAR_FROM_NOW,
      }),
    ).toThrow(/64-char hex/);
  });

  it('rejects empty identityLeaf', () => {
    const op = newWalletAs('Op');
    expect(() =>
      buildAttestReleaseAuthorityDraft({
        identityPubkey: op.identity.subject,
        identityLeaf: '   ',
        attestorName: 'Peer',
        horizonUntil: ONE_YEAR_FROM_NOW,
      }),
    ).toThrow(/identityLeaf/);
  });

  it('rejects horizonUntil in the past', () => {
    const op = newWalletAs('Op');
    const past = '2020-01-01T00:00:00Z';
    expect(() =>
      buildAttestReleaseAuthorityDraft({
        identityPubkey: op.identity.subject,
        identityLeaf: 'foo',
        attestorName: 'Peer',
        horizonUntil: past,
      }),
    ).toThrow(/after attestedAt/);
  });

  it('isAttestReleaseAuthority returns false for other credential types', () => {
    const op = newWalletAs('Op');
    const revoke = buildRevokeReleaseAuthorityDraft({
      identityPubkey: op.identity.subject,
      identityLeaf: 'foo',
      revokesAttestEnvelopeId: 'abc123',
    });
    expect(isAttestReleaseAuthority(revoke)).toBe(false);
    expect(isAttestReleaseAuthority(op.identity)).toBe(false);
  });

  it('reason is the empty string when not provided', () => {
    const op = newWalletAs('Op');
    const peer = newWalletAs('Peer');
    const draft = buildAttestReleaseAuthorityDraft({
      identityPubkey: op.identity.subject,
      identityLeaf: 'foo',
      attestorName: 'Peer',
      horizonUntil: ONE_YEAR_FROM_NOW,
    });
    const signed = peer.wallet.sign(draft);
    expect(readAttestReleaseAuthority(signed).reason).toBe('');
  });

  it('round-trips an identityLeafEnvelopeId binding (sub-cut C.3)', () => {
    const op = newWalletAs('Op');
    const peer = newWalletAs('Peer');
    const leafEnvelopeId = 'cc'.repeat(32);
    const draft = buildAttestReleaseAuthorityDraft({
      identityPubkey: op.identity.subject,
      identityLeaf: 'dynasty_trust_spend_key',
      identityLeafEnvelopeId: leafEnvelopeId,
      attestorName: 'Peer',
      horizonUntil: ONE_YEAR_FROM_NOW,
    });
    const signed = peer.wallet.sign(draft);
    expect(readAttestReleaseAuthority(signed).identityLeafEnvelopeId).toBe(
      leafEnvelopeId,
    );
  });

  it('identityLeafEnvelopeId defaults to empty string (backwards compat)', () => {
    // Attestations signed before sub-cut C.3 had no leaf-envelope-id
    // field. Reading them should produce empty string, not undefined
    // or a crash. The same behavior applies to new attestations where
    // the caller omits the field.
    const op = newWalletAs('Op');
    const peer = newWalletAs('Peer');
    const draft = buildAttestReleaseAuthorityDraft({
      identityPubkey: op.identity.subject,
      identityLeaf: 'foo',
      attestorName: 'Peer',
      horizonUntil: ONE_YEAR_FROM_NOW,
    });
    const signed = peer.wallet.sign(draft);
    expect(readAttestReleaseAuthority(signed).identityLeafEnvelopeId).toBe('');
  });

  it('rejects identityLeafEnvelopeId that is not 64-char hex when provided', () => {
    const op = newWalletAs('Op');
    expect(() =>
      buildAttestReleaseAuthorityDraft({
        identityPubkey: op.identity.subject,
        identityLeaf: 'foo',
        identityLeafEnvelopeId: 'not-hex',
        attestorName: 'Peer',
        horizonUntil: ONE_YEAR_FROM_NOW,
      }),
    ).toThrow(/identityLeafEnvelopeId must be 64-char hex/);
  });

  it('identityLeafEnvelopeId normalizes to lowercase', () => {
    const op = newWalletAs('Op');
    const peer = newWalletAs('Peer');
    const draft = buildAttestReleaseAuthorityDraft({
      identityPubkey: op.identity.subject,
      identityLeaf: 'foo',
      identityLeafEnvelopeId: 'CC'.repeat(32),
      attestorName: 'Peer',
      horizonUntil: ONE_YEAR_FROM_NOW,
    });
    const signed = peer.wallet.sign(draft);
    expect(readAttestReleaseAuthority(signed).identityLeafEnvelopeId).toBe(
      'cc'.repeat(32),
    );
  });
});

describe('revoke-release-authority', () => {
  it('builds, signs, and round-trips a revocation', () => {
    const operator = newWalletAs('Operator');
    const peer = newWalletAs('Peer');
    const draft = buildRevokeReleaseAuthorityDraft({
      identityPubkey: operator.identity.subject,
      identityLeaf: 'dynasty_trust_spend_key',
      revokesAttestEnvelopeId: 'aa'.repeat(32),
      reason: 'Something feels off about recent communications.',
    });
    const signed = peer.wallet.sign(draft);
    expect(isRevokeReleaseAuthority(signed)).toBe(true);
    const view = readRevokeReleaseAuthority(signed);
    expect(view.identityPubkey).toBe(
      operator.identity.subject.toLowerCase(),
    );
    expect(view.identityLeaf).toBe('dynasty_trust_spend_key');
    expect(view.revokesAttestEnvelopeId).toBe('aa'.repeat(32));
    expect(view.reason).toBe(
      'Something feels off about recent communications.',
    );
  });

  it('rejects empty revokesAttestEnvelopeId', () => {
    const op = newWalletAs('Op');
    expect(() =>
      buildRevokeReleaseAuthorityDraft({
        identityPubkey: op.identity.subject,
        identityLeaf: 'foo',
        revokesAttestEnvelopeId: '   ',
      }),
    ).toThrow(/revokesAttestEnvelopeId/);
  });

  it('isRevokeReleaseAuthority returns false for an attest credential', () => {
    const op = newWalletAs('Op');
    const attest = buildAttestReleaseAuthorityDraft({
      identityPubkey: op.identity.subject,
      identityLeaf: 'foo',
      attestorName: 'Peer',
      horizonUntil: ONE_YEAR_FROM_NOW,
    });
    expect(isRevokeReleaseAuthority(attest)).toBe(false);
  });
});

describe('imposter-signal', () => {
  it('builds, signs, and round-trips an imposter signal', () => {
    const operator = newWalletAs('Operator');
    const peer = newWalletAs('Peer');
    const draft = buildImposterSignalDraft({
      identityPubkey: operator.identity.subject,
      reason: 'Recent DMs do not sound like the person I have known for years.',
    });
    const signed = peer.wallet.sign(draft);
    expect(isImposterSignal(signed)).toBe(true);
    const view = readImposterSignal(signed);
    expect(view.identityPubkey).toBe(
      operator.identity.subject.toLowerCase(),
    );
    expect(view.reason).toBe(
      'Recent DMs do not sound like the person I have known for years.',
    );
    expect(view.signaledAt).toBeTruthy();
  });

  it('rejects invalid identity pubkey', () => {
    expect(() =>
      buildImposterSignalDraft({ identityPubkey: 'not-hex' }),
    ).toThrow(/64-char hex/);
  });

  it('reason is empty string when not provided', () => {
    const op = newWalletAs('Op');
    const peer = newWalletAs('Peer');
    const draft = buildImposterSignalDraft({
      identityPubkey: op.identity.subject,
    });
    const signed = peer.wallet.sign(draft);
    expect(readImposterSignal(signed).reason).toBe('');
  });

  it('isImposterSignal does not match other credential types', () => {
    const op = newWalletAs('Op');
    const attest = buildAttestReleaseAuthorityDraft({
      identityPubkey: op.identity.subject,
      identityLeaf: 'foo',
      attestorName: 'Peer',
      horizonUntil: ONE_YEAR_FROM_NOW,
    });
    const revoke = buildRevokeReleaseAuthorityDraft({
      identityPubkey: op.identity.subject,
      identityLeaf: 'foo',
      revokesAttestEnvelopeId: 'x'.repeat(64),
    });
    expect(isImposterSignal(attest)).toBe(false);
    expect(isImposterSignal(revoke)).toBe(false);
  });
});

describe('typeguard isolation', () => {
  it('each typeguard accepts only its own credential_type', () => {
    const op = newWalletAs('Op');
    const attest = buildAttestReleaseAuthorityDraft({
      identityPubkey: op.identity.subject,
      identityLeaf: 'foo',
      attestorName: 'Peer',
      horizonUntil: ONE_YEAR_FROM_NOW,
    });
    const revoke = buildRevokeReleaseAuthorityDraft({
      identityPubkey: op.identity.subject,
      identityLeaf: 'foo',
      revokesAttestEnvelopeId: 'x'.repeat(64),
    });
    const imposter = buildImposterSignalDraft({
      identityPubkey: op.identity.subject,
    });
    expect(isAttestReleaseAuthority(attest)).toBe(true);
    expect(isAttestReleaseAuthority(revoke)).toBe(false);
    expect(isAttestReleaseAuthority(imposter)).toBe(false);
    expect(isRevokeReleaseAuthority(attest)).toBe(false);
    expect(isRevokeReleaseAuthority(revoke)).toBe(true);
    expect(isRevokeReleaseAuthority(imposter)).toBe(false);
    expect(isImposterSignal(attest)).toBe(false);
    expect(isImposterSignal(revoke)).toBe(false);
    expect(isImposterSignal(imposter)).toBe(true);
  });
});
