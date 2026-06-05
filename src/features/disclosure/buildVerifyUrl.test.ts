import { describe, it, expect } from 'vitest';
import { Wallet, identityAttestation } from 'tapit-attest';
import type { Attestation } from 'tapit-attest';
import { buildVerifyUrl } from './buildVerifyUrl.ts';

// buildVerifyUrl is the shared proof-mint + verify-URL helper consumed by both
// the Fresh QuickShareModal and the journal stamped-photo corner QR. These
// tests lock its contract so the two surfaces can't silently diverge.

function newAttestation(fields: Record<string, string> = {}): Attestation {
  const wallet = Wallet.generate();
  return wallet.sign(
    identityAttestation({
      subject: wallet.publicKey,
      tier: 'notable',
      fields: { display_name: 'Test', ...fields },
    }),
  );
}

describe('buildVerifyUrl', () => {
  it('mints a one-tap inline /verify?p= URL for a small disclosure', () => {
    const att = newAttestation();
    const minted = buildVerifyUrl(att, ['display_name']);
    expect(minted.urlIsInline).toBe(true);
    expect(minted.verifyUrl).toContain('/verify?p=');
    // The JSON is a parseable proof bundle object.
    const parsed = JSON.parse(minted.json);
    expect(typeof parsed).toBe('object');
    expect(parsed).not.toBeNull();
  });

  it('discloses multiple present leaves without throwing', () => {
    const att = newAttestation({ full_name: 'Test Person' });
    expect(() =>
      buildVerifyUrl(att, ['display_name', 'full_name']),
    ).not.toThrow();
  });

  it('throws when a disclosed leaf path does not exist', () => {
    // This is exactly the case StampedPhotoButton guards against by checking
    // leaf presence before disclosing written_at.
    const att = newAttestation();
    expect(() => buildVerifyUrl(att, ['written_at'])).toThrow(/not found/);
  });
});
