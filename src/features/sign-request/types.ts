import type {
  Attestation,
  AttestationKind,
  FieldValue,
  TierName,
} from 'tapit-attest';

// Transport-agnostic message shapes for the Layer 2 inter-app
// signing pathway. The deeplink transport encodes these as
// base64-URL-decoded JSON in a query parameter; a Nostr NIP-46
// transport (later) would put them in event payloads. The shapes
// stay in this feature for v1; if multiple wallets in a fleet
// need them shared, hoist into tapit-attest.

/** Fields every request carries regardless of intent. */
interface SignRequestBase {
  v: 1;
  /**
   * Display name of the requesting app — what the operator sees
   * on the approval screen. NOT trusted: this is what the
   * requester claims to be, and the approval screen also shows
   * the callback URL host so the operator can sanity-check.
   */
  origin: string;
  /** Where to redirect the user after approve/decline. */
  callback: string;
  /** Optional nonce the requester sets to match this request with the grant. */
  nonce?: string;
}

/**
 * intent 'attest' — the wallet creates and signs a NEW attestation the
 * requester describes by kind/tier/subject/fields. The original v1 shape.
 */
export interface AttestSignRequest extends SignRequestBase {
  intent: 'attest';
  /** What kind of attestation. One of the seven library kinds. */
  kind: AttestationKind;
  /** Stakes tier — routine / notable / high_stakes. */
  tier: TierName;
  /** Who/what the claim is about. */
  subject: string;
  /** Plain claim fields the wallet will lay out as a Merkle field tree. */
  fields: Record<string, FieldValue>;
}

/**
 * intent 'cosign-existing' — the wallet ADDS its signature to an
 * already-signed envelope the requester hands over, and returns the merged
 * multi-signature envelope. This is the mutual two-party attestation path
 * (e.g. a guest signs "I stayed here," the business co-signs the same
 * envelope). The claim is NOT changed — only a signature is added — so the
 * canonical envelopeId is identical before and after.
 */
export interface CosignSignRequest extends SignRequestBase {
  intent: 'cosign-existing';
  /** The already-signed envelope the wallet is asked to countersign. */
  envelope: Attestation;
}

export type SignRequest = AttestSignRequest | CosignSignRequest;

export interface SignGrant {
  v: 1;
  nonce?: string;
  /** The signed envelope. Public — keys do not leave the wallet. For a
   *  cosign-existing grant this is the merged multi-signature envelope. */
  envelope: Attestation;
}

export type SignDeclineReason =
  | 'user_declined'
  | 'invalid_request'
  | 'unsupported_intent'
  | 'unknown_kind'
  | 'unknown_tier'
  | 'invalid_envelope';

export interface SignDecline {
  v: 1;
  nonce?: string;
  reason: SignDeclineReason;
  /** Human-readable detail; never carries wallet state. */
  detail?: string;
}
