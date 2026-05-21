import type { Attestation, Signature } from 'tapit-attest';
import { envelopeId, verifyEnvelope } from 'tapit-attest';

// Merge incoming co-signer signatures into an existing held
// attestation. The envelopeIds must match — the canonical content
// address is what we trust for matching since it is independent of
// signatures and anchor. Within signatures we dedupe by (signer, sig)
// so re-importing the same return blob is idempotent. Other-signer
// rows with bad signatures stay in the list (quorum-of-good
// verifier in tapit-attest will surface them as invalid without
// poisoning the genuine ones), but we DO sanity-check that the
// MERGED envelope still verifies on at least one signature so we
// never store something that fails wholesale.
//
// The result has the SAME envelopeId as the input, so when the
// caller hands it to wallet.hold the store replaces by id cleanly.

export interface MergeResult {
  merged: Attestation;
  newSignatures: Signature[];
}

export function mergeSignatures(
  existing: Attestation,
  incoming: Attestation,
): MergeResult {
  if (envelopeId(existing) !== envelopeId(incoming)) {
    throw new Error(
      'envelope mismatch — the pasted envelope is a different attestation than the one being absorbed into',
    );
  }
  const seen = new Set<string>();
  const out: Signature[] = [];
  const dedupKey = (s: Signature) => `${s.signer}:${s.sig}`;
  for (const s of existing.signatures) {
    const k = dedupKey(s);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(s);
    }
  }
  const newSignatures: Signature[] = [];
  for (const s of incoming.signatures) {
    const k = dedupKey(s);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(s);
      newSignatures.push(s);
    }
  }
  const merged: Attestation = { ...existing, signatures: out };
  const verification = verifyEnvelope(merged);
  if (!verification.valid) {
    throw new Error(
      'merged envelope failed verification — no surviving valid signature',
    );
  }
  return { merged, newSignatures };
}
