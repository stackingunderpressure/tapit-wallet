import { multiDisclosureProof } from 'tapit-attest';
import type { Attestation } from 'tapit-attest';

// Mint a selective-disclosure proof bundle for an attestation and turn it into
// a verifier URL. Extracted 2026-06-05 from QuickShareModal so both the Fresh
// share card and the stamped-photo corner QR build the exact same one-tap
// verify link the same way (and never drift apart).
//
// The bundle carries the Bitcoin anchor when present so /verify can re-verify
// and show the block. If the encoded inline URL fits under the byte budget we
// hand back the one-tap /verify?p=<bundle> link; past that we fall back to a
// bare /verify and the caller surfaces the proof JSON alongside.

// Cap for the inline-proof URL pathway. Most browsers and share-sheet engines
// tolerate URLs well past this, but iMessage preview generation and QR-code
// capacity prefer shorter URLs. Past this size the verify link drops to a
// bare /verify and the proof JSON travels separately.
export const INLINE_URL_BYTE_BUDGET = 1800;

export interface MintedVerify {
  /** The proof bundle as canonical JSON (for copy / paste-into-/verify). */
  json: string;
  /** Either /verify?p=<base64url> (one-tap) or a bare /verify. */
  verifyUrl: string;
  /** True when the proof rode inline in the URL. */
  urlIsInline: boolean;
}

function base64UrlEncode(input: string): string {
  // btoa works on Latin-1 strings; encodeURIComponent handles UTF-8 first,
  // then unescape collapses the percent-encoded bytes back to Latin-1 so btoa
  // accepts them. Works in every PWA target.
  const utf8 = unescape(encodeURIComponent(input));
  const b64 = btoa(utf8);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Build the proof + verify URL for the given attestation and disclosed leaf
 * paths. Throws if the proof cannot be minted (caller catches and surfaces).
 */
export function buildVerifyUrl(
  attestation: Attestation,
  disclosedPaths: string[],
): MintedVerify {
  const bundle = multiDisclosureProof(attestation, disclosedPaths);
  // Carry the Bitcoin anchor so /verify can show the block (re-verified there
  // against the proven digest). May push the bundle past the inline budget, in
  // which case the link falls back to a bare /verify — the anchor still rides
  // in the proof JSON.
  const shared = attestation.anchor
    ? { ...bundle, anchor: attestation.anchor }
    : bundle;
  const json = JSON.stringify(shared);
  const encoded = base64UrlEncode(json);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const inlineUrl = `${origin}/verify?p=${encoded}`;
  const urlIsInline = inlineUrl.length <= INLINE_URL_BYTE_BUDGET;
  return {
    json,
    verifyUrl: urlIsInline ? inlineUrl : `${origin}/verify`,
    urlIsInline,
  };
}
