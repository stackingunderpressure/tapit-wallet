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

export interface SignRequest {
  v: 1;
  /**
   * Display name of the requesting app — what the operator sees
   * on the approval screen. NOT trusted: this is what the
   * requester claims to be, and the approval screen also shows
   * the callback URL host so the operator can sanity-check.
   */
  origin: string;
  /** What the wallet is being asked to do. v1 supports 'attest' only. */
  intent: 'attest';
  /** What kind of attestation. One of the seven library kinds. */
  kind: AttestationKind;
  /** Stakes tier — routine / notable / high_stakes. */
  tier: TierName;
  /** Who/what the claim is about. */
  subject: string;
  /** Plain claim fields the wallet will lay out as a Merkle field tree. */
  fields: Record<string, FieldValue>;
  /** Where to redirect the user after approve/decline. */
  callback: string;
  /** Optional nonce the requester sets to match this request with the grant. */
  nonce?: string;
}

export interface SignGrant {
  v: 1;
  nonce?: string;
  /** The signed envelope. Public — keys do not leave the wallet. */
  envelope: Attestation;
}

export type SignDeclineReason =
  | 'user_declined'
  | 'invalid_request'
  | 'unsupported_intent'
  | 'unknown_kind'
  | 'unknown_tier';

export interface SignDecline {
  v: 1;
  nonce?: string;
  reason: SignDeclineReason;
  /** Human-readable detail; never carries wallet state. */
  detail?: string;
}
