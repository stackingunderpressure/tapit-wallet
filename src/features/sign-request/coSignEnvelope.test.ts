import { describe, it, expect } from 'vitest';
import { Wallet, envelopeId, verifyEnvelope } from 'tapit-attest';
import { coSignEnvelope } from './coSignEnvelope.ts';

// The mutual-attestation atom: a guest signs a proof-of-presence, the business
// co-signs the SAME envelope, and the result carries both signatures, still
// verifies, and keeps the identical canonical envelopeId (the claim is
// untouched — only a signature is added).

describe('coSignEnvelope', () => {
  it('adds a second signature to an existing envelope without changing the claim', () => {
    const guest = Wallet.generate();
    const business = Wallet.generate();

    const guestSigned = guest.attest({
      kind: 'agreement',
      tier: 'routine',
      subject: 'stay-cedar-2026-06',
      fields: { what: 'confirmed stay', dates: '2026-06-12/14' },
    });
    expect(guestSigned.signatures.length).toBe(1);

    const merged = coSignEnvelope(business, guestSigned);

    expect(merged.signatures.length).toBe(2);
    expect(envelopeId(merged)).toBe(envelopeId(guestSigned));
    expect(verifyEnvelope(merged).valid).toBe(true);
    const signers = merged.signatures.map((s) => s.signer);
    expect(signers).toContain(guest.identity);
    expect(signers).toContain(business.identity);
  });

  it('accumulates signatures across more than two parties (N-party runway)', () => {
    const guest = Wallet.generate();
    const business = Wallet.generate();
    const witness = Wallet.generate();
    const g = guest.attest({
      kind: 'agreement',
      tier: 'routine',
      subject: 's',
      fields: { a: 'b' },
    });
    const gb = coSignEnvelope(business, g);
    const gbw = coSignEnvelope(witness, gb);
    expect(gbw.signatures.length).toBe(3);
    expect(verifyEnvelope(gbw).valid).toBe(true);
  });
});
