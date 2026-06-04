import { splitSecret, combineShares, type Share } from 'tapit-attest';

// Family shared-secret ("safe word") — the sovereign, no-company-in-the-
// middle version of a secret your people jointly hold (2026-06-03 operator
// use case). Built on the same Shamir split/combine the recovery cohort
// uses, pointed at an arbitrary secret STRING instead of the backup key.
//
// This module is the pure, self-contained core: split a word into N
// shares such that any M of them rebuild it and fewer reveal nothing,
// and combine M shares back. No transport, no peers, no ceremony — the
// operator hands the shares out however they like (text, QR, on paper),
// and any M holders together reconstruct the word. The richer
// auto-distribute-to-your-signed-circle version is a later cut on top.
//
// Integrity: Shamir combine over TOO FEW or MISMATCHED shares does not
// error — it silently returns the wrong bytes. To make recovery honest,
// the secret is prefixed with a fixed magic marker before splitting; on
// combine we require at least the embedded threshold of shares and then
// verify the marker survived. A wrong/insufficient set fails loudly
// rather than returning garbage that looks like a "recovered" secret.

const MAGIC = 'TPSS1:'; // tapit shared-secret v1 marker

function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** One share, encoded as a single line a person can copy or scan:
 *  `tapit-secret.v1.<threshold>.<index>.<hex>` */
const PREFIX = 'tapit-secret.v1';

export function encodeShare(threshold: number, share: Share): string {
  return `${PREFIX}.${threshold}.${share.index}.${bytesToHex(share.bytes)}`;
}

interface ParsedShare {
  threshold: number;
  share: Share;
}

export function parseShare(token: string): ParsedShare | null {
  const t = token.trim();
  const parts = t.split('.');
  // tapit-secret . v1 . <threshold> . <index> . <hex>
  if (parts.length !== 5 || `${parts[0]}.${parts[1]}` !== PREFIX) return null;
  const threshold = Number(parts[2]);
  const index = Number(parts[3]);
  const hex = parts[4] ?? '';
  if (!Number.isInteger(threshold) || threshold < 1) return null;
  if (!Number.isInteger(index) || index < 1 || index > 255) return null;
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  return { threshold, share: { index, bytes: hexToBytes(hex) } };
}

/**
 * Split a secret word/phrase into `total` shares, any `threshold` of
 * which rebuild it. Returns one encoded string per share to hand out.
 */
export function splitSharedSecret(
  secret: string,
  threshold: number,
  total: number,
): string[] {
  if (secret.length === 0) throw new Error('the secret must not be empty');
  if (!Number.isInteger(threshold) || threshold < 2) {
    throw new Error('at least 2 people must be needed (threshold ≥ 2)');
  }
  if (!Number.isInteger(total) || total < threshold) {
    throw new Error('total must be at least the threshold');
  }
  if (total > 255) throw new Error('at most 255 shares');
  const bytes = new TextEncoder().encode(MAGIC + secret);
  const shares = splitSecret(bytes, threshold, total);
  return shares.map((s) => encodeShare(threshold, s));
}

export type CombineResult =
  | { ok: true; secret: string }
  | { ok: false; reason: string };

/**
 * Combine encoded shares back into the secret. Honest about failure: a
 * wrong, mismatched, or insufficient set is rejected (the magic marker
 * won't survive) rather than returning garbage.
 */
export function combineSharedSecret(tokens: readonly string[]): CombineResult {
  const parsed: ParsedShare[] = [];
  for (const t of tokens) {
    if (t.trim().length === 0) continue;
    const p = parseShare(t);
    if (!p) return { ok: false, reason: "one of these isn't a valid share — check for a typo or a missing piece" };
    parsed.push(p);
  }
  if (parsed.length === 0) return { ok: false, reason: 'paste at least one share' };
  const need = parsed[0]!.threshold;
  // De-dup by index — the same share pasted twice doesn't count twice.
  const byIndex = new Map<number, Share>();
  for (const p of parsed) byIndex.set(p.share.index, p.share);
  const shares = [...byIndex.values()];
  if (shares.length < need) {
    return { ok: false, reason: `you need ${need} different shares — you have ${shares.length}` };
  }
  let combined: Uint8Array;
  try {
    combined = combineShares(shares);
  } catch {
    return { ok: false, reason: 'these shares could not be combined' };
  }
  const text = new TextDecoder().decode(combined);
  if (!text.startsWith(MAGIC)) {
    return { ok: false, reason: "these shares don't go together — they're from different secrets or some are wrong" };
  }
  return { ok: true, secret: text.slice(MAGIC.length) };
}
