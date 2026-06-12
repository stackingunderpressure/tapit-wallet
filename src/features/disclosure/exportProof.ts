// Portable verify (2026-06-11). The whole promise of a "don't trust us,
// verify the math" system is that the verification has to be runnable
// somewhere OTHER than this page — otherwise /verify is just another walled
// garden with a green badge. This module turns a verified proof into the two
// artifacts a third party can re-check entirely off our domain:
//
//   1. the proof JSON itself — self-contained signature + Merkle math that
//      checks in any compatible verifier (or a hand-rolled one), no network,
//      no server, no app;
//   2. when the proof carries a Bitcoin anchor, a STANDARD OpenTimestamps
//      `.ots` detached-timestamp file (the anchor.proof blob IS standard .ots
//      bytes — see tapit-attest core/ots-codec serializeOtsProof/parseOtsProof)
//      that verifies with the canonical `ots` client or opentimestamps.org
//      against the envelope digest, against the public Bitcoin chain.
//
// The DOM download/clipboard side lives in the screen; the only logic worth
// isolating and testing is the hex → bytes decode, kept pure here.

/** Filename offered for the downloaded standard OpenTimestamps proof. */
export const OTS_DOWNLOAD_NAME = 'tapit-timestamp.ots';

/**
 * Decode a hex-encoded OpenTimestamps proof blob (as carried on an anchor)
 * into raw `.ots` file bytes. Throws on anything that is not clean,
 * even-length hex so a malformed blob never gets handed out as a "proof
 * file" that would fail in someone else's verifier and look like our fault.
 */
export function otsBytesFromHex(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  if (clean.length === 0) throw new Error('empty proof');
  if (clean.length % 2 !== 0) throw new Error('proof hex has an odd length');
  if (!/^[0-9a-f]+$/.test(clean)) throw new Error('proof is not valid hex');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
