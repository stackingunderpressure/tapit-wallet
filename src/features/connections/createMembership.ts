import type { Attestation, Wallet } from 'tapit-attest';
import { credentialAttestation } from 'tapit-attest';
import { displayNameOf, holdAndAnchor, leafValue } from './createHandshake.ts';
import { encodeAuthorizedBy, type AuthorizedByPayload } from '../governance/authRule.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';

// Phase 5b — organizations and membership. An organization is a
// wallet (its own identity, named for a collective). A membership is
// a credential-kind attestation the organization's wallet signs
// about a person — "[organization] declares [person] a member."
// Organizations nest: an organization holds a membership the same
// way a person does, because an organization is also a wallet.
//
// Phase E2 — joiner-side self-membership. A self-membership is a
// SECOND credential-kind shape that flips the direction: the JOINER
// signs a unilateral claim of membership in an org, and the org's
// declared join-policy (Phase E1 AuthRuleForJoin in its auth tree)
// is what decides whether the claim is valid. Same credential kind,
// distinct credential_type leaf (`self_membership`), so consumers
// never confuse the two. The org-side verifier + policy evaluator
// ships in Phase E3; this cut lands the joiner-side builder, the
// predicate + reader for routing and display, and the org-side
// inbox-acceptor placeholder that holds and anchors incoming
// self-memberships locally so they are not lost between Phases.

/** True when an attestation is a membership credential. */
export function isMembership(att: Attestation): boolean {
  return (
    att.kind === 'credential' &&
    leafValue(att, 'credential_type') === 'membership'
  );
}

/**
 * True when the envelope is a membership, names this identity as the
 * issuing org in its signed leaf, AND actually carries a signature
 * from that identity. Both checks together: the signed leaf names
 * who SHOULD have signed; the signatures list names who DID. The
 * Members view on the org side uses this to filter holdings down to
 * memberships THIS wallet has actually issued.
 */
export function isMembershipIssuedBy(
  att: Attestation,
  issuerIdentity: string,
): boolean {
  return (
    isMembership(att) &&
    leafValue(att, 'org_id') === issuerIdentity &&
    att.signatures.some((s) => s.signer === issuerIdentity)
  );
}

export interface MembershipView {
  orgId: string;
  orgName: string;
  memberId: string;
  memberName: string;
  issuedAt: string;
}

/** Read a membership credential's fields into a plain view. */
export function readMembership(att: Attestation): MembershipView {
  return {
    orgId: leafValue(att, 'org_id'),
    orgName: leafValue(att, 'org_name'),
    memberId: leafValue(att, 'member_id'),
    memberName: leafValue(att, 'member_name'),
    issuedAt: leafValue(att, 'issued_at'),
  };
}

// Verify, hold, and anchor a membership credential that arrived
// from a peer (Phase 5c-i-ι — inbox auto-receive). Throws if the
// envelope is not a membership or is addressed to someone else.
// wallet.hold internally verifies signatures, so the call is the
// authoritative integrity check. After holding, the OpenTimestamps
// queue picks up the digest the same way it does for handshakes.
export async function receiveMembership(input: {
  wallet: Wallet;
  ownerId: string;
  anchorWorker: WorkerHandle | null;
  attestation: Attestation;
  myIdentity: string;
}): Promise<void> {
  const { wallet, ownerId, anchorWorker, attestation, myIdentity } = input;
  if (!isMembership(attestation)) {
    throw new Error('not a membership credential');
  }
  const view = readMembership(attestation);
  if (view.memberId !== myIdentity) {
    throw new Error('this membership is addressed to someone else');
  }
  await holdAndAnchor(wallet, ownerId, anchorWorker, attestation);
}

// Build the unsigned membership credential. The organization's
// wallet calls this — it has scanned the recipient's identity and
// holds its own. The organization signs it; the recipient holds it.
// The subject is the recipient's canonical identity; the issuing
// organization's id and name are signed leaves so the recipient's
// Identity tab can name the organization.
//
// Phase 8 Phase C cut 3 caller-wiring: optional `authorizedBy` bakes
// a top-level `authorized_by` leaf carrying the disclosure proof of
// the auth rule the membership is issued under. The envelope's
// signature covers that leaf so the proof cannot be detached and
// swapped; verifyOrgAuthorization downstream reads it to confirm
// threshold and eligible-signer set match the org's declared rule.
// Omitted for pre-Phase-8 orgs (no auth tree) — draft falls back to
// the original five-field shape and verifyOrgAuthorization on the
// resulting envelope returns `authorized: false, reason: "envelope
// has no authorized_by leaf"`, which is the honest answer.
export function buildMembershipDraft(
  orgIdentity: Attestation,
  memberIdentity: Attestation,
  authorizedBy?: AuthorizedByPayload,
): Attestation {
  const fields: Record<string, string> = {
    credential_type: 'membership',
    org_id: orgIdentity.subject,
    org_name: displayNameOf(orgIdentity),
    member_id: memberIdentity.subject,
    member_name: displayNameOf(memberIdentity),
    issued_at: new Date().toISOString(),
  };
  if (authorizedBy) {
    fields.authorized_by = encodeAuthorizedBy(authorizedBy);
  }
  return credentialAttestation({
    subject: memberIdentity.subject,
    tier: 'notable',
    fields,
  });
}

// ---------- Phase E2 — joiner-side self-membership ----------

/** True when an attestation is a self-membership credential —
 *  a joiner's unilateral signed claim that they belong to an org.
 *  Distinct from `isMembership` which covers org-issued memberships. */
export function isSelfMembership(att: Attestation): boolean {
  return (
    att.kind === 'credential' &&
    leafValue(att, 'credential_type') === 'self_membership'
  );
}

export interface SelfMembershipView {
  joinerId: string;
  orgId: string;
  orgName: string;
  joinedAt: string;
  requestedAt: string;
}

/** Read a self-membership credential's fields into a plain view. */
export function readSelfMembership(att: Attestation): SelfMembershipView {
  return {
    joinerId: att.subject,
    orgId: leafValue(att, 'org_id'),
    orgName: leafValue(att, 'org_name'),
    joinedAt: leafValue(att, 'joined_at'),
    requestedAt: leafValue(att, 'requested_at'),
  };
}

// Build the unsigned self-membership credential. The JOINER's wallet
// calls this — it holds the joiner's own identity attestation and
// knows the org's pubkey + display name (typically from a prior
// connection or a paste of the org's identity). The joiner signs it;
// the joiner holds it; the org-side handler (if/when the envelope
// reaches it via Mycelium) evaluates the org's declared join-policy
// in Phase E3.
//
// Both `joined_at` and `requested_at` are set to the draft moment.
// Under the Option 2 substrate (purely unilateral self-claim) they
// stay identical for the life of the envelope. Under Option 1 (org
// publishes a roster), the org's roster snapshot timestamps when
// the joiner was accepted, which can be later than `requested_at`;
// the joiner's signed `requested_at` claim is preserved as the
// joiner's intent. Phase E3/E4 sharpen this distinction in code.
export function buildSelfMembershipDraft(
  joinerIdentity: Attestation,
  orgId: string,
  orgName: string,
): Attestation {
  const now = new Date().toISOString();
  return credentialAttestation({
    subject: joinerIdentity.subject,
    tier: 'notable',
    fields: {
      credential_type: 'self_membership',
      org_id: orgId,
      org_name: orgName,
      joined_at: now,
      requested_at: now,
    },
  });
}

// Phase E2 acceptor PLACEHOLDER for an incoming self-membership
// envelope. wallet.hold internally verifies the joiner's signature
// so the call is the authoritative integrity check; after holding,
// the OpenTimestamps queue picks up the digest the same way it does
// for handshakes and memberships. Phase E3 replaces this placeholder
// with the real org-side acceptor: look up the org's declared
// join-policy via findAuthRule, evaluate the joiner's claim against
// it (open / allow_list / requires_handshake / etc.), and either add
// the envelope to the pending-roster buffer or reject it. Throws if
// the envelope is not a self-membership so callers can route by
// envelope shape without relying on UI-side dispatch guarantees.
export async function receiveSelfMembership(input: {
  wallet: Wallet;
  ownerId: string;
  anchorWorker: WorkerHandle | null;
  attestation: Attestation;
}): Promise<void> {
  const { wallet, ownerId, anchorWorker, attestation } = input;
  if (!isSelfMembership(attestation)) {
    throw new Error('not a self-membership credential');
  }
  await holdAndAnchor(wallet, ownerId, anchorWorker, attestation);
}
