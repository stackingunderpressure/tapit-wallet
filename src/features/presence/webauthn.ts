// WebAuthn ceremony wrappers for the presence feature. Two
// operations: enroll a passkey (registers a new credential on this
// device, returns the credentialId + public key for the wallet to
// store), and assert with an existing credential (proves the wallet
// owner authenticated in this moment).
//
// We do NOT verify the WebAuthn signature in the wallet — that
// happens at the verifier side when someone reads the Tier V
// envelope. Here we just produce the signed-by-authenticator
// material and embed it as leaves of the attestation. The wallet's
// own BIP340 signature is what binds the whole envelope together.
//
// Honest about limits per the spec: WebAuthn proves a passkey was
// used, biometric or PIN-gated on the device. It does NOT prove a
// specific human; it proves "the credential's authentication
// requirement was satisfied at this moment by whoever was holding
// the device." That is the operator's "to the best of the device's
// ability" — Tier V is the strongest tier we can build inside a
// browser, and the spec is explicit about it.

const RP_NAME = 'Tapit Wallet';

function bytesToBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export interface EnrollResult {
  /** The new credential's id, base64url. */
  credentialIdBase64Url: string;
  /** The credential's public key, base64url-encoded SubjectPublicKeyInfo / CBOR. */
  publicKeyBase64Url: string | null;
  /** The challenge we used (so the operator can verify nothing tricky happened). */
  challengeBase64Url: string;
}

export interface AssertResult {
  credentialIdBase64Url: string;
  authenticatorDataBase64Url: string;
  clientDataJsonBase64Url: string;
  signatureBase64Url: string;
  /** The challenge we asked the authenticator to sign over. */
  challengeBase64Url: string;
}

/**
 * Is the platform capable of WebAuthn? Quick feature check so the UI
 * can show an honest "not supported on this browser" path rather
 * than crashing inside an API call.
 */
export function webauthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential === 'function' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.credentials?.create === 'function' &&
    typeof navigator.credentials?.get === 'function'
  );
}

/**
 * Enroll a new passkey on this device. The walletPubkey doubles as
 * the WebAuthn user.id (must be 1..64 bytes; our 32-byte x-only key
 * fits). The challenge is freshly random — we record it on the
 * resulting envelope so an auditor can confirm the ceremony was not
 * a replay.
 */
export async function enrollPasskey(
  walletPubkeyHex: string,
  displayName: string,
): Promise<EnrollResult> {
  if (!webauthnSupported()) {
    throw new Error('WebAuthn is not supported on this browser');
  }
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = hexToBytes(walletPubkeyHex);
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: challenge as BufferSource,
      rp: { name: RP_NAME },
      user: {
        id: userId as BufferSource,
        name: displayName,
        displayName,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        userVerification: 'required',
      },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error('passkey enrollment was cancelled');
  const rawId = new Uint8Array(credential.rawId);
  // The browser can synthesize a getPublicKey() on the AttestationResponse;
  // when not available we record null and rely on the credentialId alone.
  const att = credential.response as AuthenticatorAttestationResponse;
  let publicKeyBase64Url: string | null = null;
  if (typeof att.getPublicKey === 'function') {
    const pk = att.getPublicKey();
    if (pk) publicKeyBase64Url = bytesToBase64Url(new Uint8Array(pk));
  }
  return {
    credentialIdBase64Url: bytesToBase64Url(rawId),
    publicKeyBase64Url,
    challengeBase64Url: bytesToBase64Url(challenge),
  };
}

/**
 * Assert with the enrolled passkey. Returns the materials a verifier
 * needs to confirm the authenticator signed the challenge: the
 * authenticatorData, the clientDataJSON, the signature itself, and
 * the credentialId of the passkey that signed.
 */
export async function assertWithPasskey(
  credentialIdBase64Url: string,
): Promise<AssertResult> {
  if (!webauthnSupported()) {
    throw new Error('WebAuthn is not supported on this browser');
  }
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credentialId = base64UrlToBytes(credentialIdBase64Url);
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: challenge as BufferSource,
      allowCredentials: [
        {
          id: credentialId as BufferSource,
          type: 'public-key',
        },
      ],
      userVerification: 'required',
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!assertion) throw new Error('passkey authentication was cancelled');
  const r = assertion.response as AuthenticatorAssertionResponse;
  return {
    credentialIdBase64Url,
    authenticatorDataBase64Url: bytesToBase64Url(new Uint8Array(r.authenticatorData)),
    clientDataJsonBase64Url: bytesToBase64Url(new Uint8Array(r.clientDataJSON)),
    signatureBase64Url: bytesToBase64Url(new Uint8Array(r.signature)),
    challengeBase64Url: bytesToBase64Url(challenge),
  };
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('hex must be even-length');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
