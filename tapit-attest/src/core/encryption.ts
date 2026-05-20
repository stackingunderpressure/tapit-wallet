import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from '../internal.js';

const DEFAULT_ITERATIONS = 210_000; // OWASP 2023 floor for PBKDF2-SHA256
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 32;

/**
 * Self-describing ciphertext. Carries the KDF parameters so a blob can be
 * decrypted with only the password — nothing else need be remembered.
 */
export interface EncryptedBlob {
  v: 1;
  kdf: 'pbkdf2-sha256';
  iterations: number;
  /** hex */
  salt: string;
  /** hex */
  iv: string;
  /** hex, AES-256-GCM ciphertext (the GCM auth tag is appended by the cipher). */
  ciphertext: string;
}

function deriveKey(password: string, salt: Uint8Array, iterations: number): Uint8Array {
  return pbkdf2(sha256, utf8ToBytes(password), salt, { c: iterations, dkLen: KEY_BYTES });
}

/**
 * Encrypt the wallet client-side before it ever reaches a host. The host
 * (Supabase in v1) stores only this blob and cannot read it — dumb
 * storage, never a trusted party (ATTESTATION_PRIMITIVE_SPEC §4).
 */
export function encrypt(
  plaintext: string | Uint8Array,
  password: string,
  options: { iterations?: number } = {},
): EncryptedBlob {
  if (password.length === 0) throw new Error('password must not be empty');
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = deriveKey(password, salt, iterations);
  const data = typeof plaintext === 'string' ? utf8ToBytes(plaintext) : plaintext;
  const ciphertext = gcm(key, iv).encrypt(data);
  return {
    v: 1,
    kdf: 'pbkdf2-sha256',
    iterations,
    salt: bytesToHex(salt),
    iv: bytesToHex(iv),
    ciphertext: bytesToHex(ciphertext),
  };
}

/** Decrypt a blob to raw bytes. Throws if the password is wrong or the blob is corrupt. */
export function decrypt(blob: EncryptedBlob, password: string): Uint8Array {
  if (blob.v !== 1 || blob.kdf !== 'pbkdf2-sha256') {
    throw new Error('unsupported encrypted-blob format');
  }
  const key = deriveKey(password, hexToBytes(blob.salt), blob.iterations);
  try {
    return gcm(key, hexToBytes(blob.iv)).decrypt(hexToBytes(blob.ciphertext));
  } catch {
    throw new Error('decryption failed — wrong password or corrupt blob');
  }
}

/** Decrypt a blob and decode the bytes as a UTF-8 string. */
export function decryptToString(blob: EncryptedBlob, password: string): string {
  return new TextDecoder().decode(decrypt(blob, password));
}
