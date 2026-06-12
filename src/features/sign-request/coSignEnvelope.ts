import type { Attestation, Wallet } from 'tapit-attest';
import { mergeSignatures } from '../cosigning/mergeSignatures.ts';

// Add this wallet's signature to an already-signed envelope and return the
// merged multi-signature result. The atom under "cosign-existing" — the mutual
// two-party attestation (a guest signs "I stayed here," the business
// countersigns the SAME envelope). Pure: no holding, no anchoring, no redirect,
// so it can be unit-tested directly.
//
// wallet.sign(envelope) wraps tapit-attest's signEnvelope using the active key;
// the private key never leaves the Wallet object and the claim is untouched, so
// the canonical envelopeId is identical before and after. mergeSignatures
// dedupes by (signer, sig) and verifies the merged envelope still has a valid
// signature, throwing if the result would fail wholesale.
export function coSignEnvelope(wallet: Wallet, envelope: Attestation): Attestation {
  const signed = wallet.sign(envelope);
  return mergeSignatures(envelope, signed).merged;
}
