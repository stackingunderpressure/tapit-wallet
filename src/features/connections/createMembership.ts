import type { Attestation, DisclosureProofBundle, Wallet } from 'tapit-attest';
import { credentialAttestation } from 'tapit-attest';
import { displayNameOf, holdAndAnchor, leafValue } from './createHandshake.ts';
import {
  encodeAuthorizedBy,
  findAuthRule,
  isJoinRule,
  type AuthorizedByPayload,
} from '../governance/authRule.ts';
import { evaluateJoinPolicy } from '../governance/evaluateJoinPolicy.ts';
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

/** Phase 8 Phase E4 cut 2 — optional joiner-side proof attachments.
 *  Each field is a DisclosureProofBundle the builder JSON-stringifies
 *  into a top-level leaf on the self-membership envelope so the
 *  joiner's own signature covers the proof (it cannot be detached or
 *  swapped after signing). The org-side evaluator + verifier read
 *  these leaves to satisfy the proof-required policy kinds:
 *
 *   - `handshake_proof` — a disclosureProof of the `verification` leaf
 *     of a co-signed handshake envelope the joiner already holds. The
 *     verifier confirms proof.meta.kind is `relationship`, the proof
 *     verifies cryptographically, and the carried signatures include
 *     both the joiner and at least one pubkey from the org's declared
 *     `requires_handshake.with_any_of` set. Satisfies
 *     `requires_handshake` policy.
 *
 *   - `credential_proof` — a disclosureProof of the `credential_type`
 *     leaf of a credential the joiner holds. The verifier confirms
 *     proof.meta.kind is `credential`, proof.meta.subject is the
 *     joiner, the disclosed leaf value matches the policy's
 *     `credential_type`, and (when the policy names an issuer) the
 *     carried signatures include that issuer. Satisfies
 *     `requires_credential` policy.
 *
 *  Vouch needs no new leaf — voucher cosignatures ride
 *  envelope.signatures[] alongside the joiner's own signature; the
 *  evaluator counts them against `requires_vouch.from_any_member_count`
 *  and confirms each voucher is in the org's known-member set. */
export interface SelfMembershipProofs {
  handshake_proof?: DisclosureProofBundle;
  credential_proof?: DisclosureProofBundle;
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
//
// Phase 8 Phase E4 cut 2 — optional `proofs` parameter bakes
// joiner-side proof leaves (handshake_proof / credential_proof) so
// the org's proof-required join policies can be satisfied at receive
// time. Vouch needs no new leaf because the cosignatures already
// ride signatures[]. Omitted parameter preserves the five-field
// envelope shape Phase E2 + E3 callers already emit.
export function buildSelfMembershipDraft(
  joinerIdentity: Attestation,
  orgId: string,
  orgName: string,
  proofs?: SelfMembershipProofs,
): Attestation {
  const now = new Date().toISOString();
  const fields: Record<string, string> = {
    credential_type: 'self_membership',
    org_id: orgId,
    org_name: orgName,
    joined_at: now,
    requested_at: now,
  };
  if (proofs?.handshake_proof) {
    fields.handshake_proof = JSON.stringify(proofs.handshake_proof);
  }
  if (proofs?.credential_proof) {
    fields.credential_proof = JSON.stringify(proofs.credential_proof);
  }
  return credentialAttestation({
    subject: joinerIdentity.subject,
    tier: 'notable',
    fields,
  });
}

/** Read a `handshake_proof` leaf off a self-membership envelope and
 *  parse it back into a DisclosureProofBundle. Returns null when the
 *  leaf is absent or malformed; the cryptographic check is
 *  verifyDisclosureProof, which runs inside the evaluator. */
export function readHandshakeProof(att: Attestation): DisclosureProofBundle | null {
  return decodeProofLeaf(leafValue(att, 'handshake_proof'));
}

/** Read a `credential_proof` leaf off a self-membership envelope and
 *  parse it back into a DisclosureProofBundle. Returns null when the
 *  leaf is absent or malformed. */
export function readCredentialProof(att: Attestation): DisclosureProofBundle | null {
  return decodeProofLeaf(leafValue(att, 'credential_proof'));
}

function decodeProofLeaf(raw: string): DisclosureProofBundle | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as Record<string, unknown>;
    // Lightweight shape check; verifyDisclosureProof does the deep
    // structural + cryptographic validation downstream.
    if (typeof p.v !== 'number') return null;
    if (!p.meta || typeof p.meta !== 'object') return null;
    if (!p.leaf || typeof p.leaf !== 'object') return null;
    if (!Array.isArray(p.steps)) return null;
    if (!Array.isArray(p.signatures)) return null;
    return parsed as DisclosureProofBundle;
  } catch {
    return null;
  }
}

// Phase E3 cut 1 — org-side acceptor for an incoming self-membership
// envelope. Three structural gates run before the envelope reaches
// holdings:
//   1. Envelope shape — must be a self-membership credential.
//   2. Org self-declaration — the receiving wallet must hold a
//      self-declaration with a `join` rule in its auth tree. An org
//      that never declared a join policy implicitly does not accept
//      open joins; the request is rejected with reason.
//   3. Join-policy evaluation — the `evaluateJoinPolicy` helper runs
//      the policy against the envelope's joiner pubkey (and, in
//      Phase E4, against attached proof). Reject reasons surface
//      verbatim so a future UI can show the operator why a join
//      request did not land.
// Past the gates, wallet.hold internally verifies the joiner's
// signature (the authoritative integrity check) and the
// OpenTimestamps queue picks up the digest the same way it does for
// handshakes and memberships. Phase E3 cut 2 layers the pending-
// roster buffer and roster-publication envelope on top; the gate
// here decides whether the envelope is buffer-eligible in the first
// place.
export async function receiveSelfMembership(input: {
  wallet: Wallet;
  ownerId: string;
  anchorWorker: WorkerHandle | null;
  attestation: Attestation;
  orgSelfDecl: Attestation;
  holdings: readonly Attestation[];
}): Promise<void> {
  const { wallet, ownerId, anchorWorker, attestation, orgSelfDecl, holdings } = input;
  if (!isSelfMembership(attestation)) {
    throw new Error('not a self-membership credential');
  }
  const found = findAuthRule(orgSelfDecl, 'join');
  if (!found) {
    throw new Error('org has not declared a join policy in its auth tree');
  }
  if (!isJoinRule(found.rule)) {
    throw new Error("auth rule at slot 'join' is not a join rule");
  }
  const verdict = evaluateJoinPolicy(found.rule.policy, attestation, holdings);
  if (!verdict.accepted) {
    throw new Error(`self-membership rejected by join policy: ${verdict.reason}`);
  }
  await holdAndAnchor(wallet, ownerId, anchorWorker, attestation);
}
