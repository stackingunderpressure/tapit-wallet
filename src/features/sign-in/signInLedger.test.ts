import { describe, it, expect } from 'vitest';
import { generateKeypair } from 'tapit-attest';
import {
  recordSelfSignIn,
  toSignInRecord,
  appendSignIn,
  signInHistory,
  verifySignInRecord,
  verifySignInLedger,
  type SignInRecord,
} from './signInLedger.ts';

const audience = 'tapit-wallet.app';

describe('signInLedger', () => {
  it('records a self-issued sign-in that verifies', () => {
    const holder = generateKeypair();
    const record = recordSelfSignIn({ signerPrivateKey: holder.privateKey, audience });
    expect(record.id).toMatch(/^[0-9a-f]{64}$/);
    expect(record.attestation.signer).toBe(holder.publicKey);
    expect(verifySignInRecord(record).valid).toBe(true);
  });

  it('keys a record by its challenge nonce', () => {
    const holder = generateKeypair();
    const record = recordSelfSignIn({ signerPrivateKey: holder.privateKey, audience });
    expect(toSignInRecord(record.attestation).id).toBe(record.attestation.challenge.nonce);
  });

  it('appends without mutating and de-duplicates by id', () => {
    const holder = generateKeypair();
    const a = recordSelfSignIn({ signerPrivateKey: holder.privateKey, audience });
    const b = recordSelfSignIn({ signerPrivateKey: holder.privateKey, audience });
    expect(a.id).not.toBe(b.id); // fresh nonce each time

    const ledger0: SignInRecord[] = [];
    const ledger1 = appendSignIn(ledger0, a);
    const ledger2 = appendSignIn(ledger1, b);
    expect(ledger0).toHaveLength(0); // original untouched
    expect(ledger2).toHaveLength(2);

    const ledger3 = appendSignIn(ledger2, a); // repeat id ignored
    expect(ledger3).toHaveLength(2);
  });

  it('orders history newest sign-in first', () => {
    const holder = generateKeypair();
    const older = recordSelfSignIn({
      signerPrivateKey: holder.privateKey,
      audience,
      now: new Date('2026-01-01T00:00:00.000Z'),
    });
    const newer = recordSelfSignIn({
      signerPrivateKey: holder.privateKey,
      audience,
      now: new Date('2026-06-01T00:00:00.000Z'),
    });
    const history = signInHistory([older, newer]);
    expect(history.map((r) => r.id)).toEqual([newer.id, older.id]);
  });

  it('still verifies a stored record long after the challenge window closed', () => {
    const holder = generateKeypair();
    // ttl of 60s, issued years ago -- the window is long gone, but the stored
    // proof is a historical fact and must still verify.
    const record = recordSelfSignIn({
      signerPrivateKey: holder.privateKey,
      audience,
      now: new Date('2020-01-01T00:00:00.000Z'),
      ttlSeconds: 60,
    });
    expect(verifySignInRecord(record).valid).toBe(true);
  });

  it('drops a tampered record but keeps the sound ones', () => {
    const holder = generateKeypair();
    const good = recordSelfSignIn({ signerPrivateKey: holder.privateKey, audience });
    const bad = recordSelfSignIn({ signerPrivateKey: holder.privateKey, audience });
    // Flip the audience inside the stored proof -- breaks the signature.
    bad.attestation.challenge = { ...bad.attestation.challenge, audience: 'evil.app' };

    expect(verifySignInRecord(bad).valid).toBe(false);
    const result = verifySignInLedger([good, bad]);
    expect(result.records.map((r) => r.id)).toEqual([good.id]);
    expect(result.errors.some((e) => e.includes(bad.id))).toBe(true);
  });
});
