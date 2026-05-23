import type { Attestation, Wallet } from 'tapit-attest';
import { credentialAttestation, envelopeId } from 'tapit-attest';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';
import { leafValue } from './createHandshake.ts';

// 5b-org-i — org-mode self-declaration. A wallet says "I am an
// organization" by signing one credential-kind attestation about
// itself: subject = own identity, issuer = own identity,
// credential_type = 'organization', org_name = display name. Other
// wallets read this attestation to know the pubkey represents a
// collective rather than a person; the owning wallet reads it to
// flip the UI into org-mode (Identity tab gets an Organization
// header + a Members view of the people this wallet has admitted).
//
// One-way for now. If revocation is ever needed it would be a
// separate meta-kind attestation; out of scope this cut. The
// declaration ships through the same hold-and-anchor pipeline
// every other attestation uses, so the org-self-declaration is
// itself time-anchored to a Bitcoin block once it confirms.

/** True when an attestation is a wallet's self-declaration as an organization. */
export function isOrganizationSelfDeclaration(att: Attestation): boolean {
  return (
    att.kind === 'credential' &&
    leafValue(att, 'credential_type') === 'organization' &&
    att.subject === leafValue(att, 'pubkey')
  );
}

/** Read the declared org name out of a self-declaration attestation. */
export function readOrganizationName(att: Attestation): string {
  return leafValue(att, 'org_name');
}

/**
 * True when the holdings include a self-declaration whose subject
 * matches the operator's identity — i.e. THIS wallet has declared
 * itself an organization. Other people's self-declarations do not
 * count.
 */
export function walletIsOrganization(
  holdings: readonly Attestation[],
  myIdentity: string,
): boolean {
  return holdings.some(
    (a) => isOrganizationSelfDeclaration(a) && a.subject === myIdentity,
  );
}

/** Pull the operator's own org-self-declaration out of holdings, if any. */
export function findOwnOrgDeclaration(
  holdings: readonly Attestation[],
  myIdentity: string,
): Attestation | null {
  return (
    holdings.find(
      (a) => isOrganizationSelfDeclaration(a) && a.subject === myIdentity,
    ) ?? null
  );
}

// Build, sign, hold, and anchor the org self-declaration. The
// pubkey leaf must equal the subject so isOrganizationSelfDeclaration
// recognizes it; both are signed into the Merkle tree so a verifier
// can confirm the wallet actually declared itself rather than
// someone else trying to declare it.
export async function selfDeclareOrganization(
  wallet: Wallet,
  ownerId: string,
  anchorWorker: WorkerHandle | null,
  orgName: string,
): Promise<Attestation> {
  const trimmed = orgName.trim();
  if (trimmed.length === 0) {
    throw new Error('org name must not be empty');
  }
  const draft = credentialAttestation({
    subject: wallet.identity,
    tier: 'notable',
    fields: {
      credential_type: 'organization',
      org_name: trimmed,
      pubkey: wallet.identity,
      declared_at: new Date().toISOString(),
    },
  });
  const signed = wallet.sign(draft);
  await wallet.hold(signed);
  const digestHex = envelopeId(signed);
  await anchorQueue.upsert(ownerId, {
    digestHex,
    state: 'queued',
    anchor: null,
    attempts: 0,
    last_attempt: null,
    last_error: null,
  });
  if (anchorWorker) void anchorWorker.kick();
  return signed;
}
