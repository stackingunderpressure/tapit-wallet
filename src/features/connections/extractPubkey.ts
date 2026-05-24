import { parseEnvelope } from '../cosigning/parseEnvelope.ts';

const HEX_64 = /^[0-9a-f]{64}$/i;

/**
 * Generously extract a 64-char hex pubkey from whatever the operator
 * actually pasted. iMessage / Mail / clipboard handoffs frequently
 * include trailing newlines, NBSP characters, or stray whitespace
 * that breaks a strict `.trim()` check. And many operators will paste
 * the FULL signed identity envelope JSON their peer shared via QR or
 * "Copy as JSON" instead of just the bare pubkey — the canonical
 * subject of that envelope IS the pubkey, so we can just read it
 * out.
 *
 * Returns the lowercased 64-char hex string when extraction works,
 * null when the input isn't recognisable as either a pubkey or an
 * identity envelope. Lives in its own module so PeerPicker (a
 * component) and HandshakeModal (also a component) can both import
 * it without triggering React Fast Refresh's only-export-components
 * lint.
 */
export function extractPubkey(raw: string): string | null {
  if (!raw) return null;
  // 1. Strip all whitespace (including embedded), drop a leading 0x
  //    if present, lowercase. If the result is 64 hex chars, that
  //    is the pubkey — even if the original had stray newlines or
  //    NBSP characters that .trim() would not have caught.
  const stripped = raw
    .replace(/\s+/g, '')
    .replace(/^0x/i, '')
    .toLowerCase();
  if (HEX_64.test(stripped)) return stripped;
  // 2. Try parsing as a signed envelope. If it's an identity
  //    attestation, the canonical subject IS the pubkey — exactly
  //    what the operator would have wanted to paste anyway.
  try {
    const env = parseEnvelope(raw.trim());
    if (env.kind === 'identity' && HEX_64.test(env.subject)) {
      return env.subject.toLowerCase();
    }
  } catch {
    // not a parseable envelope — fall through
  }
  return null;
}
