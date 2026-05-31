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
  request: 'release_authority_request',
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
  /**
   * Optional 64-char hex envelopeId of the signed identity-leaf
   * credential this attestation binds to (sub-cut C.3, 2026-05-29).
   * Closes gap 2 from the gap audit — when present, the verifier
   * (sub-cut E) checks that the attestation's leaf-commitment
   * binding matches the currently-effective leaf credential, so a
   * leaf rotation (operator signs a new credential for the same
   * leaf_type) produces a new envelopeId and prior attestations
   * stop authorizing the rotated leaf. Backwards-compatible:
   * envelopes signed before this field existed parse without it
   * and read as the empty string — the verifier treats those as
   * unbound (legacy attestations that the operator can replace by
   * requesting a fresh attestation from the same peer for the
   * current leaf envelopeId).
   */
  identityLeafEnvelopeId?: string;
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
  /**
   * 64-char hex envelopeId of the signed leaf credential this
   * attestation binds to, or empty string for legacy attestations
   * predating sub-cut C.3 (2026-05-29).
   */
  identityLeafEnvelopeId: string;
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
  const leafEnvelopeId = input.identityLeafEnvelopeId?.trim() ?? '';
  if (leafEnvelopeId.length > 0 && !HEX_64.test(leafEnvelopeId)) {
    throw new Error('identityLeafEnvelopeId must be 64-char hex when provided');
  }
  return credentialAttestation({
    subject: input.identityPubkey.toLowerCase(),
    tier: 'notable',
    fields: {
      credential_type: CRED_TYPES.attest,
      identity_id: input.identityPubkey.toLowerCase(),
      identity_leaf: input.identityLeaf.trim(),
      identity_leaf_envelope_id: leafEnvelopeId.toLowerCase(),
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
    identityLeafEnvelopeId: leafValue(att, 'identity_leaf_envelope_id'),
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

// ---------------------------------------------------------------
// release-authority-request (sub-cut D.1, 2026-05-29)
// ---------------------------------------------------------------
//
// Operator-signed envelope that asks a peer to sign an
// attest-release-authority for a specific identity-leaf. Sent
// to the peer over NIP-17 gift-wrap (sub-cut D.2 wires the
// transport routing; D.3 wires the peer-side modal). The peer
// receives the request, sees a "Please attest" surface showing
// the operator's name, the requested leaf, the proposed horizon,
// and the operator's optional reason, then either one-taps
// accept (which signs an attest-release-authority envelope per
// the request's parameters and sends it back) or declines.
//
// Note the SIGNER is the OPERATOR (the identity whose release
// authority is being requested), unlike the other three release-
// authority envelope kinds which are all peer-signed. The
// identity_id leaf and the subject pubkey both name the
// operator's identity.

export interface ReleaseAuthorityRequestInput {
  /**
   * 64-char hex of the operator's identity pubkey — they will
   * sign the request envelope; the leaf names them for the
   * peer's display.
   */
  identityPubkey: string;
  /** Same identity-leaf name the attestation will cover. */
  identityLeaf: string;
  /**
   * Optional 64-char hex envelopeId of the current signed leaf
   * credential the attestation should bind to (sub-cut C.3
   * binding). Passed through so the peer's attest envelope
   * binds to the same leaf — without it, the peer has no way
   * to know which leaf envelope they are attesting for.
   */
  identityLeafEnvelopeId?: string;
  /**
   * ISO 8601 horizon the operator proposes. The peer's wallet
   * defaults the attest envelope's horizon_until to this value
   * at sign time but the peer can shorten it (never lengthen,
   * because the gate verifier's policy-freshness rule wins
   * anyway).
   */
  proposedHorizonUntil: string;
  /** Operator's display name at request time. */
  requesterName: string;
  /** Optional free-text reason / context. */
  reason?: string;
}

export interface ReleaseAuthorityRequestView {
  identityPubkey: string;
  identityLeaf: string;
  identityLeafEnvelopeId: string;
  proposedHorizonUntil: string;
  requesterName: string;
  requestedAt: string;
  reason: string;
}

export function buildReleaseAuthorityRequestDraft(
  input: ReleaseAuthorityRequestInput,
): Attestation {
  if (!HEX_64.test(input.identityPubkey)) {
    throw new Error('identityPubkey must be 64-char hex');
  }
  if (input.identityLeaf.trim().length === 0) {
    throw new Error('identityLeaf must not be empty');
  }
  if (input.requesterName.trim().length === 0) {
    throw new Error('requesterName must not be empty');
  }
  const requestedAt = new Date().toISOString();
  if (Number.isNaN(Date.parse(input.proposedHorizonUntil))) {
    throw new Error('proposedHorizonUntil must be ISO 8601');
  }
  if (Date.parse(input.proposedHorizonUntil) <= Date.parse(requestedAt)) {
    throw new Error('proposedHorizonUntil must be after requestedAt');
  }
  const leafEnvelopeId = input.identityLeafEnvelopeId?.trim() ?? '';
  if (leafEnvelopeId.length > 0 && !HEX_64.test(leafEnvelopeId)) {
    throw new Error('identityLeafEnvelopeId must be 64-char hex when provided');
  }
  return credentialAttestation({
    subject: input.identityPubkey.toLowerCase(),
    tier: 'notable',
    fields: {
      credential_type: CRED_TYPES.request,
      identity_id: input.identityPubkey.toLowerCase(),
      identity_leaf: input.identityLeaf.trim(),
      identity_leaf_envelope_id: leafEnvelopeId.toLowerCase(),
      proposed_horizon_until: input.proposedHorizonUntil,
      requester_name: input.requesterName.trim(),
      requested_at: requestedAt,
      reason: input.reason?.trim() ?? '',
    },
  });
}

export function isReleaseAuthorityRequest(att: Attestation): boolean {
  return isCredentialType(att, CRED_TYPES.request);
}

export function readReleaseAuthorityRequest(
  att: Attestation,
): ReleaseAuthorityRequestView {
  return {
    identityPubkey: leafValue(att, 'identity_id'),
    identityLeaf: leafValue(att, 'identity_leaf'),
    identityLeafEnvelopeId: leafValue(att, 'identity_leaf_envelope_id'),
    proposedHorizonUntil: leafValue(att, 'proposed_horizon_until'),
    requesterName: leafValue(att, 'requester_name'),
    requestedAt: leafValue(att, 'requested_at'),
    reason: leafValue(att, 'reason'),
  };
}
