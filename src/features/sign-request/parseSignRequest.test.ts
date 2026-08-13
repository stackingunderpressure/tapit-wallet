import { describe, it, expect } from 'vitest';
import { Wallet, verifyEnvelope } from 'tapit-attest';
import { parseSignRequest, SignRequestError } from './parseSignRequest.ts';

// Encode a request object the way an external app would: JSON -> base64.
// parseSignRequest accepts both base64 and base64url.
function encode(obj: unknown): string {
  return btoa(JSON.stringify(obj));
}

function caughtCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    return err instanceof SignRequestError ? err.code : `not-sign-request-error:${String(err)}`;
  }
  return undefined;
}

describe('parseSignRequest — attest', () => {
  it('parses a well-formed attest request', () => {
    const parsed = parseSignRequest(
      encode({
        v: 1,
        intent: 'attest',
        origin: 'TestApp',
        kind: 'journal',
        tier: 'routine',
        subject: 'me',
        fields: { text: 'hi' },
        callback: 'https://app.test/cb',
      }),
    );
    expect(parsed.intent).toBe('attest');
    if (parsed.intent === 'attest') {
      expect(parsed.kind).toBe('journal');
      expect(parsed.fields.text).toBe('hi');
    }
  });

  it('rejects a missing callback', () => {
    expect(
      caughtCode(() =>
        parseSignRequest(
          encode({
            v: 1,
            intent: 'attest',
            origin: 'X',
            kind: 'journal',
            tier: 'routine',
            subject: 'me',
            fields: {},
          }),
        ),
      ),
    ).toBe('invalid_request');
  });

  it('rejects an unknown intent', () => {
    expect(
      caughtCode(() =>
        parseSignRequest(
          encode({ v: 1, intent: 'frobnicate', origin: 'X', callback: 'https://a.test/cb' }),
        ),
      ),
    ).toBe('unsupported_intent');
  });
});

describe('parseSignRequest — cosign-existing', () => {
  function aSignedEnvelope() {
    const w = Wallet.generate();
    return w.attest({
      kind: 'agreement',
      tier: 'routine',
      subject: 'stay-1',
      fields: { what: 'stay' },
    });
  }

  it('parses a cosign-existing request carrying a valid envelope', () => {
    const envelope = aSignedEnvelope();
    const parsed = parseSignRequest(
      encode({
        v: 1,
        intent: 'cosign-existing',
        origin: 'Trailhead',
        envelope,
        callback: 'https://app.test/cb',
        nonce: 'n1',
      }),
    );
    expect(parsed.intent).toBe('cosign-existing');
    if (parsed.intent === 'cosign-existing') {
      expect(parsed.nonce).toBe('n1');
      expect(verifyEnvelope(parsed.envelope).valid).toBe(true);
    }
  });

  it('declines invalid_envelope when the envelope is not an attestation', () => {
    expect(
      caughtCode(() =>
        parseSignRequest(
          encode({
            v: 1,
            intent: 'cosign-existing',
            origin: 'X',
            envelope: { not: 'an envelope' },
            callback: 'https://a.test/cb',
          }),
        ),
      ),
    ).toBe('invalid_envelope');
  });

  it('declines when the envelope field is missing entirely', () => {
    expect(
      caughtCode(() =>
        parseSignRequest(
          encode({
            v: 1,
            intent: 'cosign-existing',
            origin: 'X',
            callback: 'https://a.test/cb',
          }),
        ),
      ),
    ).toBe('invalid_request');
  });
});

describe('parseSignRequest — sign-in', () => {
  const goodChallenge = {
    v: 1,
    nonce: 'a'.repeat(64),
    audience: 'dynastytrust.family',
    issuedAt: '2026-06-22T00:00:00.000Z',
    expiresAt: '2026-06-22T00:05:00.000Z',
  };

  it('parses a well-formed sign-in request', () => {
    const parsed = parseSignRequest(
      encode({
        v: 1,
        intent: 'sign-in',
        origin: 'DynastyTrust',
        callback: 'https://dynastytrust.family/cb',
        challenge: goodChallenge,
      }),
    );
    expect(parsed.intent).toBe('sign-in');
    if (parsed.intent === 'sign-in') {
      expect(parsed.challenge.nonce).toBe(goodChallenge.nonce);
      expect(parsed.challenge.audience).toBe('dynastytrust.family');
    }
  });

  it('rejects a sign-in request with a missing challenge', () => {
    expect(
      caughtCode(() =>
        parseSignRequest(
          encode({
            v: 1,
            intent: 'sign-in',
            origin: 'DynastyTrust',
            callback: 'https://dynastytrust.family/cb',
          }),
        ),
      ),
    ).toBe('invalid_request');
  });

  it('rejects a sign-in challenge with a bad nonce length', () => {
    expect(
      caughtCode(() =>
        parseSignRequest(
          encode({
            v: 1,
            intent: 'sign-in',
            origin: 'DynastyTrust',
            callback: 'https://dynastytrust.family/cb',
            challenge: { ...goodChallenge, nonce: 'abcd' },
          }),
        ),
      ),
    ).toBe('invalid_request');
  });

  it('rejects a sign-in challenge with an empty audience', () => {
    expect(
      caughtCode(() =>
        parseSignRequest(
          encode({
            v: 1,
            intent: 'sign-in',
            origin: 'DynastyTrust',
            callback: 'https://dynastytrust.family/cb',
            challenge: { ...goodChallenge, audience: '' },
          }),
        ),
      ),
    ).toBe('invalid_request');
  });

  it('rejects a sign-in challenge with wrong v', () => {
    expect(
      caughtCode(() =>
        parseSignRequest(
          encode({
            v: 1,
            intent: 'sign-in',
            origin: 'DynastyTrust',
            callback: 'https://dynastytrust.family/cb',
            challenge: { ...goodChallenge, v: 2 },
          }),
        ),
      ),
    ).toBe('invalid_request');
  });
});

describe('parseSignRequest — psbt-cosign', () => {
  // Same deterministic fixture as bip341-psbt-signer's own parity test
  // (packages/bip341-psbt-signer/test/parity.test.mjs in DynastyTrust) --
  // one taproot script-path input, one output, all fixed placeholder bytes.
  const VALID_PSBT_HEX =
    '70736274ff01005e020000000111111111111111111111111111111111111111111111111111111111111111110000000000fdffffff01a0860100000000002251202222222222222222222222222222222222222222222222222222222222222222000000000001012bf04902000000000022512022222222222222222222222222222222222222222222222222222222222222222215c033333333333333333333333333333333333333333333333333333333333333330251c00000';

  it('parses a well-formed psbt-cosign request', () => {
    const parsed = parseSignRequest(
      encode({
        v: 1,
        intent: 'psbt-cosign',
        origin: 'DynastyTrust',
        callback: 'https://dynastytrust.family/cb',
        psbt_hex: VALID_PSBT_HEX,
        vault_context: { vault_descriptor: 'tr_multileaf(...)', vault_name: 'Family Trust' },
      }),
    );
    expect(parsed.intent).toBe('psbt-cosign');
    if (parsed.intent === 'psbt-cosign') {
      expect(parsed.psbt_hex).toBe(VALID_PSBT_HEX);
      expect(parsed.vault_context.vault_descriptor).toBe('tr_multileaf(...)');
      expect(parsed.vault_context.vault_name).toBe('Family Trust');
    }
  });

  it('rejects a malformed psbt_hex (fails to parse as a PSBT)', () => {
    expect(
      caughtCode(() =>
        parseSignRequest(
          encode({
            v: 1,
            intent: 'psbt-cosign',
            origin: 'X',
            callback: 'https://a.test/cb',
            psbt_hex: 'deadbeef',
            vault_context: { vault_descriptor: 'v' },
          }),
        ),
      ),
    ).toBe('invalid_psbt');
  });

  it('rejects a non-hex psbt_hex', () => {
    expect(
      caughtCode(() =>
        parseSignRequest(
          encode({
            v: 1,
            intent: 'psbt-cosign',
            origin: 'X',
            callback: 'https://a.test/cb',
            psbt_hex: 'not hex!',
            vault_context: { vault_descriptor: 'v' },
          }),
        ),
      ),
    ).toBe('invalid_psbt');
  });

  it('rejects a missing vault_context', () => {
    expect(
      caughtCode(() =>
        parseSignRequest(
          encode({
            v: 1,
            intent: 'psbt-cosign',
            origin: 'X',
            callback: 'https://a.test/cb',
            psbt_hex: VALID_PSBT_HEX,
          }),
        ),
      ),
    ).toBe('invalid_request');
  });

  it('rejects an empty vault_descriptor', () => {
    expect(
      caughtCode(() =>
        parseSignRequest(
          encode({
            v: 1,
            intent: 'psbt-cosign',
            origin: 'X',
            callback: 'https://a.test/cb',
            psbt_hex: VALID_PSBT_HEX,
            vault_context: { vault_descriptor: '' },
          }),
        ),
      ),
    ).toBe('invalid_request');
  });

  // Cut B3 slice 2 — response_channel is how a Nostr-delivered request
  // (as opposed to a same-tab deeplink) tells approveSignRequest where to
  // publish the signed PSBT back to, since there is no page to redirect to.
  describe('response_channel', () => {
    const REQUESTER_PUBKEY = 'ab'.repeat(32);

    it('parses a well-formed response_channel', () => {
      const parsed = parseSignRequest(
        encode({
          v: 1,
          intent: 'psbt-cosign',
          origin: 'DynastyTrust',
          callback: 'https://dynastytrust.family/vaults',
          psbt_hex: VALID_PSBT_HEX,
          vault_context: { vault_descriptor: 'tr_multileaf(...)' },
          response_channel: { kind: 'nostr', requester_pubkey: REQUESTER_PUBKEY },
        }),
      );
      expect(parsed.intent).toBe('psbt-cosign');
      if (parsed.intent === 'psbt-cosign') {
        expect(parsed.response_channel).toEqual({ kind: 'nostr', requester_pubkey: REQUESTER_PUBKEY });
      }
    });

    it('is absent (not just undefined-but-present) when the request never had one — the B2 deeplink shape is untouched', () => {
      const parsed = parseSignRequest(
        encode({
          v: 1,
          intent: 'psbt-cosign',
          origin: 'DynastyTrust',
          callback: 'https://dynastytrust.family/vaults',
          psbt_hex: VALID_PSBT_HEX,
          vault_context: { vault_descriptor: 'tr_multileaf(...)' },
        }),
      );
      expect(parsed.intent).toBe('psbt-cosign');
      if (parsed.intent === 'psbt-cosign') {
        expect('response_channel' in parsed).toBe(false);
      }
    });

    it('rejects a response_channel with an unknown kind', () => {
      expect(
        caughtCode(() =>
          parseSignRequest(
            encode({
              v: 1,
              intent: 'psbt-cosign',
              origin: 'X',
              callback: 'https://a.test/cb',
              psbt_hex: VALID_PSBT_HEX,
              vault_context: { vault_descriptor: 'v' },
              response_channel: { kind: 'carrier-pigeon', requester_pubkey: REQUESTER_PUBKEY },
            }),
          ),
        ),
      ).toBe('invalid_request');
    });

    it('rejects a response_channel with a malformed pubkey', () => {
      expect(
        caughtCode(() =>
          parseSignRequest(
            encode({
              v: 1,
              intent: 'psbt-cosign',
              origin: 'X',
              callback: 'https://a.test/cb',
              psbt_hex: VALID_PSBT_HEX,
              vault_context: { vault_descriptor: 'v' },
              response_channel: { kind: 'nostr', requester_pubkey: 'not-hex' },
            }),
          ),
        ),
      ).toBe('invalid_request');
    });

    it('rejects a non-object response_channel', () => {
      expect(
        caughtCode(() =>
          parseSignRequest(
            encode({
              v: 1,
              intent: 'psbt-cosign',
              origin: 'X',
              callback: 'https://a.test/cb',
              psbt_hex: VALID_PSBT_HEX,
              vault_context: { vault_descriptor: 'v' },
              response_channel: 'nostr',
            }),
          ),
        ),
      ).toBe('invalid_request');
    });
  });
});
