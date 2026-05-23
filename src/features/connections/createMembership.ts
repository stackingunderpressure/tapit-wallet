import type { Attestation, Wallet } from 'tapit-attest';
import { credentialAttestation } from 'tapit-attest';
import { displayNameOf, holdAndAnchor, leafValue } from './createHandshake.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';

// Phase 5b — organizations and membership. An organization is a
// wallet (its own identity, named for a collective). A membership is
// a credential-kind attestation the organization's wallet signs
// about a person — "[organization] declares [person] a member."
// Organizations nest: an organization holds a membership the same
// way a person does, because an organization is also a wallet.

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
export function buildMembershipDraft(
  orgIdentity: Attestation,
  memberIdentity: Attestation,
): Attestation {
  return credentialAttestation({
    subject: memberIdentity.subject,
    tier: 'notable',
    fields: {
      credential_type: 'membership',
      org_id: orgIdentity.subject,
      org_name: displayNameOf(orgIdentity),
      member_id: memberIdentity.subject,
      member_name: displayNameOf(memberIdentity),
      issued_at: new Date().toISOString(),
    },
  });
}
