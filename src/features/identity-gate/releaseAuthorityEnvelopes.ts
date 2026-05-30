import type { Attestation } from 'tapit-attest';
import { credentialAttestation } from 'tapit-attest';

// Three envelope kinds for the peer-mediated identity gate
// substrate (PLAN.md Founding Vision + Tier 1 item 11 sub-cut B,
// 2026-05-29). All three ride on the existing credential
// attestation primitive in tapit-attest with a credential_type
// discriminator — matches the family-unit + recovery-cohort
// pattern, no new envelope-kind machinery required.
//
// Conceptual roles in the gate substrate:
//   - attest-release-authority: a peer signs "I attest that this
//     identity holds release authority for leaf X at time T, for
//     horizon H." The disclosure-proof verifier in sub-cut E will
//     count these toward the M-of-N gate threshold.
//   - revoke-release-authority: a peer signs "I withdraw my prior
//     attestation for leaf X." A later attestation by the same
//     peer for the same leaf supersedes — but explicit revocation
//     stales the prior attestation immediately, so the gate stops
//     resolving until either re-attestation or a different peer
//     fills the threshold.
//   - imposter-signal: a peer signs "I think this identity may
//     no longer be the operator." Distinct from revocation
//     because it's broader — it suggests the underlying identity
//     itself is compromised, not just that this peer is
//     withdrawing release-authority. Sub-cut F surfaces these to
//     the operator's other gate-peers as the social
//     imposter-detect signal.
//
// All three credentials carry the operator's identity pubkey as
// the SUBJECT (because they are facts ABOUT that identity, signed
// BY a peer). The peer's wallet does the signing; the credential
// envelope shape itself is symmetric across the three with
// credential_type as the discriminator.

const CRED_TYPES = {
  attest: 'release_authority_attest',
  revoke: 'release_authority_revoke',
  imposter: 'imposter_signal',
} as const;

const HEX_64 = /^[0-9a-f]{64}$/i;

function leafValue(att: Attestation, name: string): string {
  const claim = att.claim;
  const child = claim.children.find((c) => c.name === name);
  if (!child || child.node !== 'leaf') return '';
  return typeof child.value === 'string' ? child.value : '';
}

function isCredentialType(att: Attestation, type: string): boolean {
  return att.kind === 'credential' && leafValue(att, 'credential_type') === type;
}

// ---------------------------------------------------------------
// attest-release-authority
// ---------------------------------------------------------------

export interface AttestReleaseAuthorityInput {
  /** 64-char hex pubkey of the identity being attested to. */
  identityPubkey: string;
  /**
   * Name of the identity-leaf this attestation covers (e.g.
   * 'dynasty_trust_spend_key', 'wealth_strategy_auth',
   * 'recovery_cohort_share'). Free-form string; the convention
   * is `<context>_<purpose>` lowercase-snake.
   */
  identityLeaf: string;
  /** Peer's display name at signing time. */
  attestorName: string;
  /** ISO 8601 of when the attestation horizon ends. */
  horizonUntil: string;
  /** Optional free-text reason / context. */
  reason?: string;
}

export interface AttestReleaseAuthorityView {
  identityPubkey: string;
  identityLeaf: string;
  attestorName: string;
  attestedAt: string;
  horizonUntil: string;
  reason: string;
}

export function buildAttestReleaseAuthorityDraft(
  input: AttestReleaseAuthorityInput,
): Attestation {
  if (!HEX_64.test(input.identityPubkey)) {
    throw new Error('identityPubkey must be 64-char hex');
  }
  if (input.identityLeaf.trim().length === 0) {
    throw new Error('identityLeaf must not be empty');
  }
  if (input.attestorName.trim().length === 0) {
    throw new Error('attestorName must not be empty');
  }
  const attestedAt = new Date().toISOString();
  if (Number.isNaN(Date.parse(input.horizonUntil))) {
    throw new Error('horizonUntil must be ISO 8601');
  }
  if (Date.parse(input.horizonUntil) <= Date.parse(attestedAt)) {
    throw new Error('horizonUntil must be after attestedAt');
  }
  return credentialAttestation({
    subject: input.identityPubkey.toLowerCase(),
    tier: 'notable',
    fields: {
      credential_type: CRED_TYPES.attest,
      identity_id: input.identityPubkey.toLowerCase(),
      identity_leaf: input.identityLeaf.trim(),
      attestor_name: input.attestorName.trim(),
      attested_at: attestedAt,
      horizon_until: input.horizonUntil,
      reason: input.reason?.trim() ?? '',
    },
  });
}

export function isAttestReleaseAuthority(att: Attestation): boolean {
  return isCredentialType(att, CRED_TYPES.attest);
}

export function readAttestReleaseAuthority(
  att: Attestation,
): AttestReleaseAuthorityView {
  return {
    identityPubkey: leafValue(att, 'identity_id'),
    identityLeaf: leafValue(att, 'identity_leaf'),
    attestorName: leafValue(att, 'attestor_name'),
    attestedAt: leafValue(att, 'attested_at'),
    horizonUntil: leafValue(att, 'horizon_until'),
    reason: leafValue(att, 'reason'),
  };
}

// ---------------------------------------------------------------
// revoke-release-authority
// ---------------------------------------------------------------

export interface RevokeReleaseAuthorityInput {
  identityPubkey: string;
  identityLeaf: string;
  /** envelopeId of the prior attest-release-authority being revoked. */
  revokesAttestEnvelopeId: string;
  reason?: string;
}

export interface RevokeReleaseAuthorityView {
  identityPubkey: string;
  identityLeaf: string;
  revokesAttestEnvelopeId: string;
  revokedAt: string;
  reason: string;
}

export function buildRevokeReleaseAuthorityDraft(
  input: RevokeReleaseAuthorityInput,
): Attestation {
  if (!HEX_64.test(input.identityPubkey)) {
    throw new Error('identityPubkey must be 64-char hex');
  }
  if (input.identityLeaf.trim().length === 0) {
    throw new Error('identityLeaf must not be empty');
  }
  if (input.revokesAttestEnvelopeId.trim().length === 0) {
    throw new Error('revokesAttestEnvelopeId must not be empty');
  }
  return credentialAttestation({
    subject: input.identityPubkey.toLowerCase(),
    tier: 'notable',
    fields: {
      credential_type: CRED_TYPES.revoke,
      identity_id: input.identityPubkey.toLowerCase(),
      identity_leaf: input.identityLeaf.trim(),
      revokes_attest_id: input.revokesAttestEnvelopeId.trim(),
      revoked_at: new Date().toISOString(),
      reason: input.reason?.trim() ?? '',
    },
  });
}

export function isRevokeReleaseAuthority(att: Attestation): boolean {
  return isCredentialType(att, CRED_TYPES.revoke);
}

export function readRevokeReleaseAuthority(
  att: Attestation,
): RevokeReleaseAuthorityView {
  return {
    identityPubkey: leafValue(att, 'identity_id'),
    identityLeaf: leafValue(att, 'identity_leaf'),
    revokesAttestEnvelopeId: leafValue(att, 'revokes_attest_id'),
    revokedAt: leafValue(att, 'revoked_at'),
    reason: leafValue(att, 'reason'),
  };
}

// ---------------------------------------------------------------
// imposter-signal
// ---------------------------------------------------------------

export interface ImposterSignalInput {
  identityPubkey: string;
  reason?: string;
}

export interface ImposterSignalView {
  identityPubkey: string;
  signaledAt: string;
  reason: string;
}

export function buildImposterSignalDraft(
  input: ImposterSignalInput,
): Attestation {
  if (!HEX_64.test(input.identityPubkey)) {
    throw new Error('identityPubkey must be 64-char hex');
  }
  return credentialAttestation({
    subject: input.identityPubkey.toLowerCase(),
    tier: 'notable',
    fields: {
      credential_type: CRED_TYPES.imposter,
      identity_id: input.identityPubkey.toLowerCase(),
      signaled_at: new Date().toISOString(),
      reason: input.reason?.trim() ?? '',
    },
  });
}

export function isImposterSignal(att: Attestation): boolean {
  return isCredentialType(att, CRED_TYPES.imposter);
}

export function readImposterSignal(att: Attestation): ImposterSignalView {
  return {
    identityPubkey: leafValue(att, 'identity_id'),
    signaledAt: leafValue(att, 'signaled_at'),
    reason: leafValue(att, 'reason'),
  };
}
