import type { Attestation, Wallet } from 'tapit-attest';
import { credentialAttestation, envelopeId } from 'tapit-attest';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';
import { leafValue } from '../connections/createHandshake.ts';
import type { AssertResult, EnrollResult } from './webauthn.ts';
import type { FreshLocation } from './geolocation.ts';

// Phase 5d Tier V — device-verified presence.
//
// Two credential shapes ship together:
//
// 1. Passkey-enrollment credential — subject = own identity,
//    credential_type = 'device-passkey'. Holds the credentialId
//    (and public key, when the browser surfaces it) of a passkey
//    the wallet owner has enrolled on this device. Used at presence
//    time to ask the right authenticator to assert.
//
// 2. Presence credential — subject = own identity,
//    credential_type = 'tier-v-presence'. Holds latitude, longitude,
//    accuracy, timestamp, AND the WebAuthn assertion materials
//    (credentialId, authenticatorData, clientDataJSON, signature,
//    challenge). A verifier can independently re-derive the
//    authenticator's signature input and check it against the
//    public key recorded by the enrollment credential — if those
//    keys are exchanged out of band — closing the loop.
//
// Honest about limits per spec: geolocation can be spoofed at the
// platform level; the WebAuthn assertion proves the credential's
// userVerification policy was satisfied (Face ID, Touch ID, PIN,
// platform unlock), which is the strongest signal a browser-based
// wallet can produce that the wallet OWNER and not just the
// device-holder authenticated in that moment. "To the best of the
// device's ability" — the spec wording stays.

/** True when this attestation is a device-passkey enrollment record. */
export function isDevicePasskey(att: Attestation): boolean {
  return (
    att.kind === 'credential' &&
    leafValue(att, 'credential_type') === 'device-passkey'
  );
}

/** True when this attestation is a Tier V presence event. */
export function isPresenceEvent(att: Attestation): boolean {
  return (
    att.kind === 'credential' &&
    leafValue(att, 'credential_type') === 'tier-v-presence'
  );
}

export interface PasskeyDeviceView {
  credentialId: string;
  publicKey: string;
  enrolledAt: string;
}

export function readDevicePasskey(att: Attestation): PasskeyDeviceView {
  return {
    credentialId: leafValue(att, 'credential_id'),
    publicKey: leafValue(att, 'public_key'),
    enrolledAt: leafValue(att, 'enrolled_at'),
  };
}

export interface PresenceView {
  latitude: string;
  longitude: string;
  accuracyMeters: string;
  fixedAt: string;
  signedAt: string;
  credentialId: string;
}

export function readPresence(att: Attestation): PresenceView {
  return {
    latitude: leafValue(att, 'latitude'),
    longitude: leafValue(att, 'longitude'),
    accuracyMeters: leafValue(att, 'accuracy_meters'),
    fixedAt: leafValue(att, 'fixed_at'),
    signedAt: leafValue(att, 'signed_at'),
    credentialId: leafValue(att, 'passkey_credential_id'),
  };
}

/**
 * Find the wallet's most recent device-passkey enrollment, if any.
 * Multiple enrollments are fine (different devices, replacement
 * passkeys); the newest by issuedAt wins for the "use this passkey"
 * default.
 */
export function findLatestDevicePasskey(
  holdings: readonly Attestation[],
  walletIdentity: string,
): Attestation | null {
  let latest: Attestation | null = null;
  let latestMs = -Infinity;
  for (const a of holdings) {
    if (!isDevicePasskey(a)) continue;
    if (a.subject !== walletIdentity) continue;
    if (!a.signatures.some((s) => s.signer === walletIdentity)) continue;
    const ms = new Date(a.issuedAt).getTime();
    if (!Number.isFinite(ms)) continue;
    if (ms > latestMs) {
      latestMs = ms;
      latest = a;
    }
  }
  return latest;
}

/**
 * Build, sign, hold, and anchor a passkey-enrollment credential.
 * Records the credentialId + public key from a successful
 * navigator.credentials.create() ceremony.
 */
export async function holdDevicePasskey(
  wallet: Wallet,
  ownerId: string,
  anchorWorker: WorkerHandle | null,
  enroll: EnrollResult,
): Promise<Attestation> {
  const draft = credentialAttestation({
    subject: wallet.identity,
    tier: 'notable',
    fields: {
      credential_type: 'device-passkey',
      credential_id: enroll.credentialIdBase64Url,
      public_key: enroll.publicKeyBase64Url ?? '',
      enrolled_at: new Date().toISOString(),
      enrollment_challenge: enroll.challengeBase64Url,
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

/**
 * Build, sign, hold, and anchor a Tier V presence event. Composes
 * a fresh WebAuthn assertion (already obtained from the
 * authenticator) with a fresh geolocation reading. The signedAt
 * leaf is the wallet's local clock at signing time; fixedAt is the
 * platform's GPS reading time; they should be close but the spec
 * records both so a verifier can see how stale the location was at
 * sign moment.
 */
export async function holdPresenceEvent(
  wallet: Wallet,
  ownerId: string,
  anchorWorker: WorkerHandle | null,
  location: FreshLocation,
  assertion: AssertResult,
): Promise<Attestation> {
  const draft = credentialAttestation({
    subject: wallet.identity,
    tier: 'notable',
    fields: {
      credential_type: 'tier-v-presence',
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      accuracy_meters: String(location.accuracyMeters),
      fixed_at: location.fixedAt,
      signed_at: new Date().toISOString(),
      passkey_credential_id: assertion.credentialIdBase64Url,
      passkey_authenticator_data: assertion.authenticatorDataBase64Url,
      passkey_client_data: assertion.clientDataJsonBase64Url,
      passkey_signature: assertion.signatureBase64Url,
      passkey_challenge: assertion.challengeBase64Url,
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
