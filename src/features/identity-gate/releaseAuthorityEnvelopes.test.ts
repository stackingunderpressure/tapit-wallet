import { describe, it, expect } from 'vitest';
import { Wallet, identityAttestation } from 'tapit-attest';
import type { Attestation } from 'tapit-attest';
import {
  buildAttestReleaseAuthorityDraft,
  buildImposterSignalDraft,
  buildReleaseAuthorityRequestDraft,
  buildRevokeReleaseAuthorityDraft,
  isAttestReleaseAuthority,
  isImposterSignal,
  isReleaseAuthorityRequest,
  isRevokeReleaseAuthority,
  readAttestReleaseAuthority,
  readImposterSignal,
  readReleaseAuthorityRequest,
  readRevokeReleaseAuthority,
  findMyGivenVouches,
} from './releaseAuthorityEnvelopes.ts';
import { envelopeId } from 'tapit-attest';

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

describe('release-authority-request', () => {
  it('builds, signs, and round-trips an operator-signed request', () => {
    const op = newWalletAs('Operator');
    const draft = buildReleaseAuthorityRequestDraft({
      identityPubkey: op.identity.subject,
      identityLeaf: 'dynasty_trust_spend_key',
      identityLeafEnvelopeId: 'aa'.repeat(32),
      proposedHorizonUntil: ONE_YEAR_FROM_NOW,
      requesterName: 'Operator',
      reason: 'About to authorize a spend; please attest.',
    });
    const signed = op.wallet.sign(draft);
    expect(isReleaseAuthorityRequest(signed)).toBe(true);
    const view = readReleaseAuthorityRequest(signed);
    expect(view.identityPubkey).toBe(op.identity.subject.toLowerCase());
    expect(view.identityLeaf).toBe('dynasty_trust_spend_key');
    expect(view.identityLeafEnvelopeId).toBe('aa'.repeat(32));
    expect(view.proposedHorizonUntil).toBe(ONE_YEAR_FROM_NOW);
    expect(view.requesterName).toBe('Operator');
    expect(view.reason).toBe('About to authorize a spend; please attest.');
    expect(view.requestedAt).toBeTruthy();
  });

  it('rejects empty identityLeaf', () => {
    const op = newWalletAs('Op');
    expect(() =>
      buildReleaseAuthorityRequestDraft({
        identityPubkey: op.identity.subject,
        identityLeaf: '  ',
        proposedHorizonUntil: ONE_YEAR_FROM_NOW,
        requesterName: 'Op',
      }),
    ).toThrow(/identityLeaf/);
  });

  it('rejects empty requesterName', () => {
    const op = newWalletAs('Op');
    expect(() =>
      buildReleaseAuthorityRequestDraft({
        identityPubkey: op.identity.subject,
        identityLeaf: 'foo',
        proposedHorizonUntil: ONE_YEAR_FROM_NOW,
        requesterName: '   ',
      }),
    ).toThrow(/requesterName/);
  });

  it('rejects proposedHorizonUntil in the past', () => {
    const op = newWalletAs('Op');
    expect(() =>
      buildReleaseAuthorityRequestDraft({
        identityPubkey: op.identity.subject,
        identityLeaf: 'foo',
        proposedHorizonUntil: '2020-01-01T00:00:00Z',
        requesterName: 'Op',
      }),
    ).toThrow(/after requestedAt/);
  });

  it('rejects invalid identityLeafEnvelopeId when provided', () => {
    const op = newWalletAs('Op');
    expect(() =>
      buildReleaseAuthorityRequestDraft({
        identityPubkey: op.identity.subject,
        identityLeaf: 'foo',
        identityLeafEnvelopeId: 'not-hex',
        proposedHorizonUntil: ONE_YEAR_FROM_NOW,
        requesterName: 'Op',
      }),
    ).toThrow(/64-char hex/);
  });

  it('identityLeafEnvelopeId is optional and defaults to empty string', () => {
    const op = newWalletAs('Op');
    const draft = buildReleaseAuthorityRequestDraft({
      identityPubkey: op.identity.subject,
      identityLeaf: 'foo',
      proposedHorizonUntil: ONE_YEAR_FROM_NOW,
      requesterName: 'Op',
    });
    const signed = op.wallet.sign(draft);
    expect(readReleaseAuthorityRequest(signed).identityLeafEnvelopeId).toBe('');
  });

  it('isReleaseAuthorityRequest isolates from other release-authority kinds', () => {
    const op = newWalletAs('Op');
    const peer = newWalletAs('Peer');
    const attest = peer.wallet.sign(
      buildAttestReleaseAuthorityDraft({
        identityPubkey: op.identity.subject,
        identityLeaf: 'foo',
        attestorName: 'Peer',
        horizonUntil: ONE_YEAR_FROM_NOW,
      }),
    );
    const revoke = peer.wallet.sign(
      buildRevokeReleaseAuthorityDraft({
        identityPubkey: op.identity.subject,
        identityLeaf: 'foo',
        revokesAttestEnvelopeId: 'x'.repeat(64),
      }),
    );
    const imposter = peer.wallet.sign(
      buildImposterSignalDraft({ identityPubkey: op.identity.subject }),
    );
    const request = op.wallet.sign(
      buildReleaseAuthorityRequestDraft({
        identityPubkey: op.identity.subject,
        identityLeaf: 'foo',
        proposedHorizonUntil: ONE_YEAR_FROM_NOW,
        requesterName: 'Op',
      }),
    );
    expect(isReleaseAuthorityRequest(attest)).toBe(false);
    expect(isReleaseAuthorityRequest(revoke)).toBe(false);
    expect(isReleaseAuthorityRequest(imposter)).toBe(false);
    expect(isReleaseAuthorityRequest(request)).toBe(true);
    expect(isAttestReleaseAuthority(request)).toBe(false);
    expect(isRevokeReleaseAuthority(request)).toBe(false);
    expect(isImposterSignal(request)).toBe(false);
  });
});

describe('findMyGivenVouches (item 11 F)', () => {
  it('lists the attests this wallet signed and marks withdrawn ones', () => {
    const me = newWalletAs('Voucher');
    const op = newWalletAs('Operator');
    const attest1 = me.wallet.sign(
      buildAttestReleaseAuthorityDraft({
        identityPubkey: op.wallet.identity,
        identityLeaf: 'spend_key',
        attestorName: 'Voucher',
        horizonUntil: ONE_YEAR_FROM_NOW,
      }),
    );
    const attest2 = me.wallet.sign(
      buildAttestReleaseAuthorityDraft({
        identityPubkey: op.wallet.identity,
        identityLeaf: 'recovery_share',
        attestorName: 'Voucher',
        horizonUntil: ONE_YEAR_FROM_NOW,
      }),
    );
    // Withdraw attest1.
    const revoke = me.wallet.sign(
      buildRevokeReleaseAuthorityDraft({
        identityPubkey: op.wallet.identity,
        identityLeaf: 'spend_key',
        revokesAttestEnvelopeId: envelopeId(attest1),
      }),
    );
    const given = findMyGivenVouches(
      [me.identity, attest1, attest2, revoke],
      me.wallet.publicKey,
    );
    expect(given.length).toBe(2);
    const byLeaf = Object.fromEntries(given.map((g) => [g.identityLeaf, g.withdrawn]));
    expect(byLeaf['spend_key']).toBe(true);
    expect(byLeaf['recovery_share']).toBe(false);
  });

  it('does not list vouches signed by other people', () => {
    const me = newWalletAs('Me');
    const other = newWalletAs('Other');
    const op = newWalletAs('Operator');
    const theirAttest = other.wallet.sign(
      buildAttestReleaseAuthorityDraft({
        identityPubkey: op.wallet.identity,
        identityLeaf: 'spend_key',
        attestorName: 'Other',
        horizonUntil: ONE_YEAR_FROM_NOW,
      }),
    );
    expect(findMyGivenVouches([me.identity, theirAttest], me.wallet.publicKey)).toEqual([]);
  });
});
