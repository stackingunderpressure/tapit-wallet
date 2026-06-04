import type { Attestation } from 'tapit-attest';
import { envelopeId, verifyEnvelope } from 'tapit-attest';
import {
  isAttestReleaseAuthority,
  isRevokeReleaseAuthority,
  readAttestReleaseAuthority,
  readRevokeReleaseAuthority,
} from './releaseAuthorityEnvelopes.ts';
import {
  findLatestReleaseGatePolicyLeaf,
  findLatestVouchingCircleLeaf,
  isReleaseGatePolicyLeaf,
  isVouchingCircleLeaf,
  readReleaseGatePolicyLeaf,
  readVouchingCircleLeaf,
} from './identityLeafCredential.ts';
import { verifyGatedRelease, type GatedReleaseVerdict } from './verifyGatedRelease.ts';

// Item 11 sub-cut D4 — the shareable gated-release bundle. After the
// operator collects enough peer vouches (D3 shows "resolved"), they can
// PRESENT the resolved gate to an outside verifier — a stranger who does
// not have to trust the operator, the Tapit app, or this device, only the
// math. The bundle packages everything the verifier needs to re-run
// verifyGatedRelease independently:
//   - the operator's signed release_gate_policy leaf (which peers, M-of-N)
//   - the operator's signed vouching_circle leaf (the eligible-set anchor)
//   - the peer attest/revoke envelopes for this leaf
//   - the identity pubkey
//
// CRITICAL STRANGER-SIDE SECURITY (the reason verifyGatedReleaseBundle is
// separate from verifyGatedRelease): the underlying verifier TRUSTS that
// the gatePolicy + vouchingCircle views it is handed are the operator's
// real ones. In the bundle case the verifier has no such guarantee — an
// attacker could swap in a forged policy that names their own keys. So
// verifyGatedReleaseBundle FIRST re-checks that the policy leaf and the
// vouching-circle leaf are (a) the right leaf types and (b) cryptographically
// SIGNED BY the claimed identity, before trusting their contents. Only then
// does it run verifyGatedRelease, which separately enforces that the
// policy's eligible set is a subset of the vouching circle. Two independent
// anchors, both rooted in the identity's own signature, is what lets a
// stranger trust the result without trusting the messenger.
//
// Honest-scope (operator doctrine): a "released" verdict means "M peers
// the operator designated, who are in the operator's own vouching circle,
// signed fresh vouches that this identity controls leaf X." It does NOT
// mean the claim behind the leaf is true, or that the verifier must act on
// it — it is an extra, above-and-beyond proof the verifier weighs with
// their own judgment.

export interface GatedReleaseBundle {
  v: 1;
  bundle_type: 'gated_release';
  identityPubkey: string;
  forLeaf: string;
  /** The operator's signed release_gate_policy leaf for forLeaf. */
  policy: Attestation;
  /** The operator's signed vouching_circle leaf. */
  vouchingCircle: Attestation;
  /** Peer attest-release-authority + revoke envelopes for this leaf. */
  attestations: Attestation[];
}

/**
 * Package the currently-effective gate for `forLeaf` into a shareable
 * bundle. Returns null when there is no signed policy or no signed
 * vouching circle to anchor against. Pure.
 */
export function buildGatedReleaseBundle(
  holdings: readonly Attestation[],
  identityPubkey: string,
  forLeaf: string,
): GatedReleaseBundle | null {
  const policy = findLatestReleaseGatePolicyLeaf(holdings, identityPubkey, forLeaf);
  const vouchingCircle = findLatestVouchingCircleLeaf(holdings, identityPubkey);
  if (!policy || !vouchingCircle) return null;
  const attestations = holdings.filter((a) => {
    if (isAttestReleaseAuthority(a)) {
      return readAttestReleaseAuthority(a).identityLeaf === forLeaf;
    }
    if (isRevokeReleaseAuthority(a)) {
      return readRevokeReleaseAuthority(a).identityLeaf === forLeaf;
    }
    return false;
  });
  return {
    v: 1,
    bundle_type: 'gated_release',
    identityPubkey: identityPubkey.toLowerCase(),
    forLeaf,
    policy,
    vouchingCircle,
    attestations,
  };
}

export type GatedReleaseBundleVerdict =
  | GatedReleaseVerdict
  | { kind: 'refused'; reason: 'malformed-bundle'; detail: string; bundleResult: null };

function signedBy(att: Attestation, identityPubkey: string): boolean {
  const id = identityPubkey.toLowerCase();
  if (att.subject.toLowerCase() !== id) return false;
  const result = verifyEnvelope(att);
  return result.valid && result.signers.some((s) => s.valid && s.signer.toLowerCase() === id);
}

/**
 * Verify a gated-release bundle as a STRANGER would — re-rooting the
 * policy and vouching-circle in the identity's own signature before
 * trusting them, then running the full verifyGatedRelease. `now` is
 * injectable for tests.
 */
export function verifyGatedReleaseBundle(
  bundle: GatedReleaseBundle,
  now?: number,
): GatedReleaseBundleVerdict {
  if (bundle.bundle_type !== 'gated_release' || bundle.v !== 1) {
    return { kind: 'refused', reason: 'malformed-bundle', detail: 'not a gated-release bundle', bundleResult: null };
  }
  if (!isReleaseGatePolicyLeaf(bundle.policy) || !signedBy(bundle.policy, bundle.identityPubkey)) {
    return {
      kind: 'refused',
      reason: 'malformed-bundle',
      detail: 'the gate policy is not a valid leaf signed by this identity',
      bundleResult: null,
    };
  }
  if (!isVouchingCircleLeaf(bundle.vouchingCircle) || !signedBy(bundle.vouchingCircle, bundle.identityPubkey)) {
    return {
      kind: 'refused',
      reason: 'malformed-bundle',
      detail: 'the vouching circle is not a valid leaf signed by this identity',
      bundleResult: null,
    };
  }
  const gatePolicy = readReleaseGatePolicyLeaf(bundle.policy);
  if (gatePolicy.forLeaf !== bundle.forLeaf) {
    return {
      kind: 'refused',
      reason: 'malformed-bundle',
      detail: 'the gate policy is for a different leaf than the bundle claims',
      bundleResult: null,
    };
  }
  const vouchingCirclePubkeys = readVouchingCircleLeaf(bundle.vouchingCircle).pubkeys;
  return verifyGatedRelease({
    attestations: bundle.attestations,
    gatePolicy,
    vouchingCirclePubkeys,
    identityPubkey: bundle.identityPubkey,
    currentLeafEnvelopeId: envelopeId(bundle.policy),
    ...(now !== undefined ? { now } : {}),
  });
}
