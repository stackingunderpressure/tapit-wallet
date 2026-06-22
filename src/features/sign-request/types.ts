import type {
  Attestation,
  AttestationKind,
  FieldValue,
  SignInAttestation,
  SignInChallenge,
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

/**
 * intent 'sign-in' — the wallet answers a verifier-issued login challenge by
 * signing it, proving the user controls their key. NO new attestation is
 * created and NO funds move; the only thing produced is a SignInAttestation
 * carrying the user's public key, the echoed challenge, and a Schnorr
 * signature. The verifier (e.g. DynastyTrust) minted the challenge, persists
 * it, and checks the returned attestation against its own stored copy. The
 * challenge travels inside the request; the wallet signs the SAME challenge
 * verbatim so the verifier's echo check passes.
 */
export interface SignInSignRequest extends SignRequestBase {
  intent: 'sign-in';
  /** The verifier-issued, single-use challenge to answer. */
  challenge: SignInChallenge;
}

export type SignRequest =
  | AttestSignRequest
  | CosignSignRequest
  | SignInSignRequest;

export interface SignGrant {
  v: 1;
  nonce?: string;
  /**
   * The signed envelope. Public — keys do not leave the wallet. For a
   * cosign-existing grant this is the merged multi-signature envelope.
   * Present for 'attest' and 'cosign-existing' grants; ABSENT for a
   * 'sign-in' grant, which carries `signIn` instead.
   */
  envelope?: Attestation;
  /**
   * The signed login proof. Present ONLY for a 'sign-in' grant. A
   * SignInAttestation is NOT an Attestation envelope (different shape, no
   * Merkle field tree, no anchoring), so it gets its own explicit field
   * rather than being shoehorned into `envelope`. The verifier reads this,
   * matches the echoed challenge against its stored copy, and checks the
   * signature against the user's public key — no key material crosses the
   * wire, only the public key and the signature.
   */
  signIn?: SignInAttestation;
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
