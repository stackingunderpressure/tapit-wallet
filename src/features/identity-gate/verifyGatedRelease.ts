import type { Attestation } from 'tapit-attest';
import type {
  ReleaseGatePolicyView,
} from './identityLeafCredential.ts';
import {
  readAttestReleaseAuthority,
} from './releaseAuthorityEnvelopes.ts';
import {
  verifyReleaseAuthorityBundle,
  type AttestationVerdict,
  type VerifyReleaseAuthorityBundleResult,
} from './verifyReleaseAuthorityBundle.ts';

// Item 11 sub-cut E.2 (2026-05-29) — composes the
// verifyReleaseAuthorityBundle wrapper from sub-cut E.1 with the
// release_gate_policy leaf type from sub-cut C.4 to produce the
// final "released / refused" judgment the release-ceremony UX
// (sub-cut D) and external verifier consumers (DynastyTrust,
// Wealth Strategy, etc.) read.
//
// Three composition rules layered on top of the per-attestation
// verifier:
//
//   1. Policy-eligible-set-subset-of-vouching-circle. The
//      operator's release_gate_policy.eligible_pubkeys MUST be a
//      subset of their currently-effective vouching_circle leaf.
//      A tampered policy that names peers outside the operator's
//      designated vouching circle is REFUSED with kind=
//      policy-tampered. Closes gap 10 partially — even if an
//      attacker rewrites a gate policy to add unfamiliar attestors,
//      the verifier rejects it.
//
//   2. Freshness-horizon-precedence. The OPERATOR'S
//      release_gate_policy.freshness_horizon_hours wins over the
//      ATTESTER'S horizon_until. An attestation that the attester
//      claimed valid until 2030 is still STALE if the policy says
//      30 days and the attestation was signed 31 days ago. This
//      is the coercion-resistance property — the operator's
//      current policy controls. Sub-cut G's hybrid ping mechanism
//      will let peers re-freshen attestations one-tap within a
//      shorter ping window without forcing a full re-attestation.
//
//   3. Threshold. validCount must be >= policy.threshold. The
//      threshold is the M of "M of N peers must attest" in the
//      gate policy.
//
// What this still does NOT close (deferred to subsequent sub-cuts):
//   - Cross-leaf consistency (a peer who attested leaf A is
//     separately verified for leaf B). Caller passes one leaf's
//     attestations at a time.
//   - The release ceremony UX (operator-facing "request
//     attestations now" flow) — sub-cut D.
//   - The imposter-signal social channel (peer-side signal
//     surfaces) — sub-cut F.
//   - The hybrid-ping freshness alternative path — sub-cut G.

export type GatedReleaseVerdict =
  | {
      kind: 'released';
      validAttestorPubkeys: readonly string[];
      validCount: number;
      threshold: number;
      bundleResult: VerifyReleaseAuthorityBundleResult;
    }
  | {
      kind: 'refused';
      reason:
        | 'policy-tampered'
        | 'threshold-not-met'
        | 'no-valid-attestations';
      detail: string;
      bundleResult: VerifyReleaseAuthorityBundleResult | null;
    };

export interface VerifyGatedReleaseInput {
  /**
   * Mixed bundle of attest-release-authority + revoke-release-
   * authority envelopes for the specific identity-leaf being
   * verified. Caller filters to one leaf's worth of attestations.
   */
  attestations: readonly Attestation[];
  /**
   * Parsed view of the operator's current release_gate_policy
   * leaf for the target identity-leaf (sub-cut C.4 helper output).
   */
  gatePolicy: ReleaseGatePolicyView;
  /**
   * Lowercase-hex pubkeys from the operator's currently-effective
   * vouching_circle leaf (sub-cut C.1 helper output). Used to
   * validate the policy-eligible-set-subset-of-vouching-circle
   * invariant.
   */
  vouchingCirclePubkeys: readonly string[];
  /** The identity whose release-authority is being verified. */
  identityPubkey: string;
  /**
   * Optional envelopeId of the currently-effective signed leaf
   * credential (the target leaf being released, not the gate
   * policy or the vouching circle). When provided, the
   * underlying verifier requires per-attestation leaf-binding
   * to this envelopeId.
   */
  currentLeafEnvelopeId?: string;
  /** Override the wall-clock for testability. Defaults to Date.now(). */
  now?: number;
}

function lower(s: string): string {
  return s.toLowerCase();
}

export function verifyGatedRelease(
  input: VerifyGatedReleaseInput,
): GatedReleaseVerdict {
  const now = input.now ?? Date.now();
  const policy = input.gatePolicy;

  // Rule 1: policy-eligible-set must be a subset of vouching circle.
  // A policy that names peers outside the operator's designated
  // vouching circle is rejected — the substrate enforces that an
  // attacker rewriting the policy cannot widen the eligible set
  // beyond who the operator has actually approved.
  const vouchingSet = new Set(input.vouchingCirclePubkeys.map(lower));
  const policyEligibleLower = policy.eligiblePubkeys.map(lower);
  const outsideVouching = policyEligibleLower.filter(
    (p) => !vouchingSet.has(p),
  );
  if (outsideVouching.length > 0) {
    return {
      kind: 'refused',
      reason: 'policy-tampered',
      detail: `gate policy names ${outsideVouching.length} eligible peer(s) outside the operator's vouching circle: ${outsideVouching.slice(0, 3).join(', ')}${outsideVouching.length > 3 ? '…' : ''}`,
      bundleResult: null,
    };
  }

  // Run the underlying per-attestation verifier with the policy's
  // eligible set. The bundle verifier already applies the
  // attester's horizon_until staleness check, the signer-eligibility
  // check, the same-peer revoke-supersedes rule, and the optional
  // leaf-binding check.
  const bundleResult = verifyReleaseAuthorityBundle({
    attestations: input.attestations,
    identityPubkey: input.identityPubkey,
    eligiblePubkeys: policyEligibleLower,
    ...(input.currentLeafEnvelopeId
      ? { currentLeafEnvelopeId: input.currentLeafEnvelopeId }
      : {}),
    now,
  });

  // Rule 2: freshness-horizon-precedence. The operator's policy
  // freshness window is more restrictive than the attester's
  // horizon_until. Filter the bundle's valid attestations to
  // those signed within (now - freshness_horizon_hours).
  const freshnessWindowMs =
    policy.freshnessHorizonHours * 60 * 60 * 1000;
  const freshnessThreshold = now - freshnessWindowMs;
  const freshAttestorPubkeys = new Set<string>();
  for (const verdict of bundleResult.verdicts) {
    if (verdict.kind !== 'valid') continue;
    const attView = readAttestReleaseAuthority(verdict.attestation);
    const attestedAtMs = Date.parse(attView.attestedAt);
    if (!Number.isFinite(attestedAtMs)) continue;
    if (attestedAtMs < freshnessThreshold) continue;
    freshAttestorPubkeys.add(verdict.attestorPubkey);
  }
  const freshCount = freshAttestorPubkeys.size;

  // Rule 3: threshold check.
  if (freshCount === 0) {
    return {
      kind: 'refused',
      reason: 'no-valid-attestations',
      detail: `no fresh valid attestations from eligible peers (policy freshness window: ${policy.freshnessHorizonHours} hours)`,
      bundleResult,
    };
  }

  if (freshCount < policy.threshold) {
    return {
      kind: 'refused',
      reason: 'threshold-not-met',
      detail: `${freshCount} of ${policy.threshold} required fresh attestations from eligible peers (policy freshness window: ${policy.freshnessHorizonHours} hours)`,
      bundleResult,
    };
  }

  return {
    kind: 'released',
    validAttestorPubkeys: Array.from(freshAttestorPubkeys).sort(),
    validCount: freshCount,
    threshold: policy.threshold,
    bundleResult,
  };
}

// Re-export the underlying types so callers don't have to import
// from two places.
export type { AttestationVerdict, VerifyReleaseAuthorityBundleResult };
