import { schnorr } from '@noble/curves/secp256k1';
import type { Attestation } from '../types.js';
import { bytesToHex, hexToBytes, isHex } from '../internal.js';
import { attestationDigest } from './envelope.js';

export interface Keypair {
  /** 32-byte secp256k1 secret key, hex. */
  privateKey: string;
  /** 32-byte x-only secp256k1 public key, hex. */
  publicKey: string;
}

/** Generate a fresh BIP340 Schnorr keypair. */
export function generateKeypair(): Keypair {
  const priv = schnorr.utils.randomSecretKey();
  return {
    privateKey: bytesToHex(priv),
    publicKey: bytesToHex(schnorr.getPublicKey(priv)),
  };
}

/** Derive the x-only public key for a private key. */
export function publicKeyFromPrivate(privateKey: string): string {
  if (!isHex(privateKey, 32)) throw new Error('privateKey must be 32-byte hex');
  return bytesToHex(schnorr.getPublicKey(hexToBytes(privateKey)));
}

/**
 * Sign the attestation digest and attach the signature. If this signer
 * already signed the envelope, its signature is replaced — re-signing
 * after an edit never leaves a stale or duplicate signature behind.
 * Returns a new Attestation; the input is not mutated.
 */
export function signEnvelope(a: Attestation, privateKey: string): Attestation {
  if (!isHex(privateKey, 32)) throw new Error('privateKey must be 32-byte hex');
  const priv = hexToBytes(privateKey);
  const signer = bytesToHex(schnorr.getPublicKey(priv));
  const sig = bytesToHex(schnorr.sign(attestationDigest(a), priv));
  const signatures = a.signatures.filter((s) => s.signer !== signer);
  signatures.push({ signer, sig });
  return { ...a, signatures };
}

/** Verify one Schnorr signature over a digest. Never throws. */
export function verifySignature(
  digest: Uint8Array,
  sig: string,
  publicKey: string,
): boolean {
  if (!isHex(sig, 64) || !isHex(publicKey, 32)) return false;
  try {
    return schnorr.verify(hexToBytes(sig), digest, hexToBytes(publicKey));
  } catch {
    return false;
  }
}

export interface SignerResult {
  signer: string;
  valid: boolean;
}

export interface VerifyResult {
  /** True only when there is at least one signature and all signatures verify. */
  valid: boolean;
  /** Hex of the digest every signature was checked against. */
  digest: string;
  signers: SignerResult[];
  errors: string[];
}

/**
 * Verify every signature on an attestation against its recomputed digest.
 * A tampered subject, tier, timestamp, or claim field changes the digest
 * and surfaces here as an invalid signature — the envelope is
 * self-verifying.
 */
export function verifyEnvelope(a: Attestation): VerifyResult {
  const errors: string[] = [];
  const digestBytes = attestationDigest(a);
  const signers: SignerResult[] = a.signatures.map((s) => ({
    signer: s.signer,
    valid: verifySignature(digestBytes, s.sig, s.signer),
  }));
  for (const s of signers) {
    if (!s.valid) errors.push(`invalid signature from ${s.signer}`);
  }
  if (a.signatures.length === 0) errors.push('attestation has no signatures');
  return {
    valid: errors.length === 0,
    digest: bytesToHex(digestBytes),
    signers,
    errors,
  };
}
