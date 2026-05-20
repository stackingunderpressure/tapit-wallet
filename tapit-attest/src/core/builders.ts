import type { Attestation, AttestationKind, FieldBranch, TierName } from '../types.js';
import { createDraft } from './envelope.js';

export interface BuilderInput {
  subject: string;
  tier: TierName;
  /** A plain object (converted to a field tree) or a prebuilt FieldBranch. */
  fields: Record<string, unknown> | FieldBranch;
  /** ISO 8601; defaults to now. */
  issuedAt?: string;
}

function builder(kind: AttestationKind) {
  return (input: BuilderInput): Attestation => createDraft({ kind, ...input });
}

/** Who a public key belongs to. (DynastyTrust origin: `descriptor`.) */
export const identityAttestation = builder('identity');

/** A recurring, corroborated relationship / continuity. (`proof_of_life`.) */
export const relationshipAttestation = builder('relationship');

/** Something the subject did or earned. */
export const credentialAttestation = builder('credential');

/** A future outcome, anchored before the event — reality verifies it. */
export const predictionAttestation = builder('prediction');

/** A multi-party mutual commitment. (`trust_doc`.) */
export const agreementAttestation = builder('agreement');

/** Repudiation / revocation / key-succession. (`death_declaration`.) */
export const metaAttestation = builder('meta');
