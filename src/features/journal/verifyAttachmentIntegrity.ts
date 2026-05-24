import { sha256 } from '@noble/hashes/sha256';
import { mediaStore } from '../storage/mediaStore.ts';

// Re-hash a journal entry's attachment and compare to the SHA-256
// the envelope's claim tree committed to at signing time. Returns
// 'match' when the bytes you just decrypted hash to exactly what
// the signed-and-anchored envelope says they should, 'mismatch'
// when something has changed since signing, and 'missing' when the
// attachment cannot be located in local IndexedDB or in cloud
// storage (e.g., the encrypted ciphertext was lost, the cloud
// mirror is unreachable).
//
// The 'match' outcome is the load-bearing claim a third party can
// trust: the envelope's signature was made over the claim tree,
// the claim tree's attachment_sha256 leaf names a specific hash,
// the envelope's OpenTimestamps anchor proves the envelope existed
// by a specific Bitcoin block height, and the bytes you re-read
// today hash to that same value — therefore no one has tampered
// with the file since you saved it on the day it was anchored.
//
// 'mismatch' is the corruption signal: either the local IDB record
// got rewritten by something outside the wallet's normal write
// path, or the cloud-mirror was tampered with at the storage layer.
// Either way the operator should treat the local copy as untrusted
// and pull a fresh copy from any other source (backup file, cohort
// peer, the original they uploaded from).

export type VerifyResult =
  | { state: 'match'; bytes: Uint8Array; mime: string }
  | { state: 'mismatch'; expected: string; actual: string }
  | { state: 'missing' };

function bytesToHex(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) {
    s += (b[i] ?? 0).toString(16).padStart(2, '0');
  }
  return s;
}

export async function verifyAttachmentIntegrity(
  ownerId: string,
  passphrase: string,
  expectedSha256Hex: string,
): Promise<VerifyResult> {
  const fetched = await mediaStore.get(ownerId, passphrase, expectedSha256Hex);
  if (!fetched) {
    return { state: 'missing' };
  }
  const actual = bytesToHex(sha256(fetched.bytes));
  if (actual.toLowerCase() === expectedSha256Hex.toLowerCase()) {
    return { state: 'match', bytes: fetched.bytes, mime: fetched.mime };
  }
  return { state: 'mismatch', expected: expectedSha256Hex, actual };
}
