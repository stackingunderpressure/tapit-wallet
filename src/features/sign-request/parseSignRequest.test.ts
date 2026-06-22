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
