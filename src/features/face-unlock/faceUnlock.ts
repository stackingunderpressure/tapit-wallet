import { idb } from '../../shared/lib/idb.ts';

// Face ID (or Touch ID, Windows Hello, an Android fingerprint) instead of
// typing the passphrase. Built on a passkey with the WebAuthn PRF extension:
// when the person passes Face ID, the passkey releases a 32-byte secret that
// only it can produce, and that secret unlocks a copy of the passphrase
// sealed on this device. Nothing leaves the device; there is no server.
//
// What this is, plainly:
// - The wallet is still encrypted under the passphrase. Face ID only opens a
//   locally stored copy of that passphrase. Typing it always still works.
// - Turning it off deletes the sealed copy. Forgetting the passphrase is
//   still unrecoverable except by a backup file plus passphrase.
// - Someone who has this device's storage AND can pass Face ID on the passkey
//   can unlock the wallet. That is the trade the person opts into.
// - With Face ID on, every signature asks for it again (confirmFaceId).

const KEY = (ownerId: string) => `face-unlock:${ownerId}`;
const HKDF_INFO = new TextEncoder().encode('tapit-face-unlock-v1');

export interface FaceUnlockRecord {
  credentialId: string; // base64url
  salt: string; // hex, the PRF input
  iv: string; // hex
  ciphertext: string; // hex, AES-GCM of the passphrase
  created_at: string;
}

export class FaceUnlockUnavailable extends Error {}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (s: string) => new Uint8Array((s.match(/../g) ?? []).map((h) => parseInt(h, 16)));
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

export function faceUnlockSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function'
    && typeof navigator.credentials?.get === 'function';
}

async function aesKey(prfOutput: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', prfOutput as BufferSource, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: HKDF_INFO as BufferSource },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

type PrfResults = { prf?: { results?: { first?: ArrayBuffer | Uint8Array } } };

/** Ask the passkey for its PRF secret. Passing Face ID is what releases it. */
async function prfSecret(credentialId: Uint8Array, salt: Uint8Array): Promise<Uint8Array> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)) as BufferSource,
      allowCredentials: [{ id: credentialId as BufferSource, type: 'public-key' }],
      userVerification: 'required',
      timeout: 60_000,
      extensions: { prf: { eval: { first: salt as BufferSource } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('Face ID was cancelled.');
  const first = (cred.getClientExtensionResults() as PrfResults).prf?.results?.first;
  if (!first) throw new FaceUnlockUnavailable("This browser didn't give the wallet a Face ID key, so Face ID can't unlock it here. Your passphrase still works.");
  return new Uint8Array(first);
}

export async function loadFaceUnlock(ownerId: string): Promise<FaceUnlockRecord | undefined> {
  return idb.get<FaceUnlockRecord>(KEY(ownerId));
}

/** Turn Face ID on. `passphrase` must be the one that opens this wallet; the
 *  caller has it in memory from the current unlock. Creates a passkey, checks
 *  it can release a PRF secret, seals the passphrase, and stores the seal. */
export async function enableFaceUnlock(ownerId: string, userIdHex: string, passphrase: string): Promise<FaceUnlockRecord> {
  if (!faceUnlockSupported()) throw new FaceUnlockUnavailable("This browser can't use Face ID for the wallet.");
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const created = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)) as BufferSource,
      rp: { name: 'Tapit Wallet' },
      user: { id: unhex(userIdHex).slice(0, 64) as BufferSource, name: 'Tapit Wallet unlock', displayName: 'Tapit Wallet unlock' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', userVerification: 'required' },
      timeout: 60_000,
      extensions: { prf: { eval: { first: salt as BufferSource } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!created) throw new Error('Face ID setup was cancelled.');
  const credentialId = new Uint8Array(created.rawId);
  // Newer browsers hand the PRF secret back at creation; older ones need a
  // second Face ID pass to get it.
  const atCreate = (created.getClientExtensionResults() as PrfResults).prf?.results?.first;
  const secret = atCreate ? new Uint8Array(atCreate) : await prfSecret(credentialId, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, await aesKey(secret, salt), new TextEncoder().encode(passphrase));
  const record: FaceUnlockRecord = {
    credentialId: b64u(credentialId),
    salt: hex(salt),
    iv: hex(iv),
    ciphertext: hex(new Uint8Array(ct)),
    created_at: new Date().toISOString(),
  };
  // Read it straight back before saving, so a seal that cannot be opened is
  // never stored.
  if ((await openSeal(record, secret)) !== passphrase) throw new Error('Face ID setup could not be checked; nothing was saved.');
  await idb.put(KEY(ownerId), record);
  return record;
}

async function openSeal(record: FaceUnlockRecord, secret: Uint8Array): Promise<string> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unhex(record.iv) as BufferSource },
    await aesKey(secret, unhex(record.salt)),
    unhex(record.ciphertext) as BufferSource,
  );
  return new TextDecoder().decode(pt);
}

/** Pass Face ID and get the passphrase back, to unlock exactly as typing would. */
export async function unlockWithFace(record: FaceUnlockRecord): Promise<string> {
  const secret = await prfSecret(unb64u(record.credentialId), unhex(record.salt));
  try {
    return await openSeal(record, secret);
  } catch {
    throw new Error('Face ID worked, but the saved unlock could not be opened. Type your passphrase, then turn Face ID off and on again in Settings.');
  }
}

/** Before a signature: if Face ID is on, pass it again. Resolves silently
 *  when Face ID is off, so the wallet behaves as before. */
export async function confirmFaceId(ownerId: string): Promise<void> {
  const record = await loadFaceUnlock(ownerId);
  if (!record) return;
  // Opening the seal proves it is this wallet's passkey, not just any passkey.
  await unlockWithFace(record);
}

export async function disableFaceUnlock(ownerId: string): Promise<void> {
  await idb.delete(KEY(ownerId));
}
