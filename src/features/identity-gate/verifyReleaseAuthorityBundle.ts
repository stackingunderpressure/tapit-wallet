import type { Attestation } from 'tapit-attest';
import { envelopeId, verifyEnvelope } from 'tapit-attest';
import {
  isAttestReleaseAuthority,
  isRevokeReleaseAuthority,
  readAttestReleaseAuthority,
  readRevokeReleaseAuthority,
} from './releaseAuthorityEnvelopes.ts';

// Item 11 sub-cut E.1 (2026-05-29) — first verifier wrapper for
// the peer-mediated identity gate substrate (PLAN.md Founding
// Vision + Tier 1 item 11). Turns the envelope bytes shipped in
// sub-cut B into a yes/no judgment against an eligible-peer set
// + freshness window + revocation supersedes + leaf-binding.
//
// Closes gap 6 partially (envelopes become a gate when composed
// against this verifier). Closes gap 3 by filtering attestation
// inputs to attest-release-authority envelopes only — imposter
// signals shipped in sub-cut B are NOT counted toward release
// authority (they ride a separate signal channel surfaced in
// sub-cut F). Sub-cut E.2 will compose this verifier with a
// gate-policy leaf (threshold + horizon) so the verifier returns
// "release authorized / refused" instead of just per-attestation
// verdicts and a valid-count.
//
// What this verifier does NOT do (yet):
//   - Compose against a release_gate_policy identity-leaf — that
//     leaf type doesn't exist yet (sub-cut C.4 or D will add it).
//     Today the verifier takes eligiblePubkeys as a parameter so
//     the caller resolves them from the latest vouching_circle
//     leaf, or from whatever ad-hoc rule they choose for testing.
//   - Apply a threshold check — the caller compares validCount
//     to whatever M-of-N rule they have. Sub-cut E.2 will absorb
//     this into the verifier once gate-policy leaves exist.
//   - Verify cross-leaf consistency (a peer who attested for
//     leaf A is also valid for leaf B). The caller passes one
//     leaf's attestations at a time; cross-leaf composition is
//     out of scope here.

export type AttestationVerdict =
  | {
      kind: 'valid';
      attestorPubkey: string;
      attestation: Attestation;
    }
  | {
      kind: 'invalid';
      attestation: Attestation;
      reason:
        | 'not-attest-envelope'
        | 'signature-invalid'
        | 'signer-not-eligible'
        | 'identity-mismatch'
        | 'stale'
        | 'revoked'
        | 'leaf-binding-mismatch';
      detail: string;
    };

export interface VerifyReleaseAuthorityBundleInput {
  /**
   * Mixed bundle of attest-release-authority and revoke-release-
   * authority envelopes. The verifier filters to attests, applies
   * revokes as supersedes (latest-revoke-from-same-signer
   * invalidates the attest), ignores imposter-signal and other
   * credential kinds.
   */
  attestations: readonly Attestation[];
  /** The identity whose release-authority is being verified. */
  identityPubkey: string;
  /**
   * Pubkeys of peers eligible to attest. Caller resolves this
   * (typically from the operator's latest vouching_circle leaf).
   */
  eligiblePubkeys: readonly string[];
  /**
   * Optional envelopeId of the currently-effective signed leaf
   * credential. When provided, attestations whose
   * identity_leaf_envelope_id does not match are rejected with
   * the leaf-binding-mismatch reason — closes gap 2's anti-
   * rotation property. When absent, the binding is not checked
   * (backwards-compatible mode).
   */
  currentLeafEnvelopeId?: string;
  /** Override the wall-clock for testability. Defaults to Date.now(). */
  now?: number;
}

export interface VerifyReleaseAuthorityBundleResult {
  /** One verdict per input attestation, preserving order. */
  verdicts: readonly AttestationVerdict[];
  /**
   * Distinct attestor pubkeys with at least one valid attestation
   * in the bundle. Duplicate attestations from the same signer
   * count once. Suitable for comparing against an M-of-N threshold.
   */
  validAttestorPubkeys: readonly string[];
  /** Convenience: validAttestorPubkeys.length. */
  validCount: number;
}

function lower(s: string): string {
  return s.toLowerCase();
}

export function verifyReleaseAuthorityBundle(
  input: VerifyReleaseAuthorityBundleInput,
): VerifyReleaseAuthorityBundleResult {
  const now = input.now ?? Date.now();
  const identityLower = lower(input.identityPubkey);
  const eligibleSet = new Set(input.eligiblePubkeys.map(lower));
  const leafBinding = input.currentLeafEnvelopeId
    ? lower(input.currentLeafEnvelopeId)
    : null;

  // Collect revocations from the bundle keyed by
  // (revoker-pubkey, revokes-attest-envelope-id). A revoke
  // signed by peer P against attest A invalidates attest A
  // when peer P is also the attester. Cross-peer revocation
  // (peer P revokes peer Q's attestation) is meaningless and
  // ignored.
  const revocations = new Map<string, Set<string>>();
  for (const att of input.attestations) {
    if (!isRevokeReleaseAuthority(att)) continue;
    const revokeView = readRevokeReleaseAuthority(att);
    if (lower(revokeView.identityPubkey) !== identityLower) continue;
    // The revoke envelope's SIGNER is the peer doing the revoking.
    for (const sig of att.signatures) {
      const signer = lower(sig.signer);
      if (!revocations.has(signer)) revocations.set(signer, new Set());
      revocations.get(signer)!.add(lower(revokeView.revokesAttestEnvelopeId));
    }
  }

  const verdicts: AttestationVerdict[] = [];
  const validSigners = new Set<string>();

  for (const att of input.attestations) {
    if (!isAttestReleaseAuthority(att)) {
      // Revoke + imposter + other envelopes are filtered out of
      // the per-attestation verdict list — the bundle holds
      // attests-to-verify; revokes are applied as supersedes
      // above; imposter signals ride a separate channel.
      continue;
    }
    const attView = readAttestReleaseAuthority(att);

    if (lower(attView.identityPubkey) !== identityLower) {
      verdicts.push({
        kind: 'invalid',
        attestation: att,
        reason: 'identity-mismatch',
        detail: `attestation's identity_id does not match the verifying identity`,
      });
      continue;
    }

    const cryptoResult = verifyEnvelope(att);
    if (!cryptoResult.valid) {
      verdicts.push({
        kind: 'invalid',
        attestation: att,
        reason: 'signature-invalid',
        detail: cryptoResult.errors.join('; ') || 'no valid signatures',
      });
      continue;
    }

    const eligibleSigner = cryptoResult.signers.find(
      (s) => s.valid && eligibleSet.has(lower(s.signer)),
    );
    if (!eligibleSigner) {
      verdicts.push({
        kind: 'invalid',
        attestation: att,
        reason: 'signer-not-eligible',
        detail: 'no signature from a peer in the eligible vouching circle',
      });
      continue;
    }
    const attestorLower = lower(eligibleSigner.signer);

    const horizonMs = Date.parse(attView.horizonUntil);
    if (!Number.isFinite(horizonMs) || horizonMs <= now) {
      verdicts.push({
        kind: 'invalid',
        attestation: att,
        reason: 'stale',
        detail: `horizon_until ${attView.horizonUntil} has passed`,
      });
      continue;
    }

    const attEnvelopeId = lower(envelopeId(att));
    const revokedByThisAttestor = revocations.get(attestorLower);
    if (revokedByThisAttestor?.has(attEnvelopeId)) {
      verdicts.push({
        kind: 'invalid',
        attestation: att,
        reason: 'revoked',
        detail: 'a revoke-release-authority envelope in the bundle supersedes this attestation',
      });
      continue;
    }

    if (leafBinding !== null) {
      const attBinding = lower(attView.identityLeafEnvelopeId);
      if (attBinding !== leafBinding) {
        verdicts.push({
          kind: 'invalid',
          attestation: att,
          reason: 'leaf-binding-mismatch',
          detail: attBinding
            ? `attestation binds to a different leaf envelopeId`
            : `attestation has no leaf-envelopeId binding (legacy or unbound)`,
        });
        continue;
      }
    }

    verdicts.push({
      kind: 'valid',
      attestorPubkey: attestorLower,
      attestation: att,
    });
    validSigners.add(attestorLower);
  }

  const validAttestorPubkeys = Array.from(validSigners).sort();
  return {
    verdicts,
    validAttestorPubkeys,
    validCount: validAttestorPubkeys.length,
  };
}
