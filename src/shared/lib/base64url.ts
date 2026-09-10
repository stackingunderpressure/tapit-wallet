// base64url — the encode/decode pair every "put a proof in a URL" surface in
// this wallet needs (buildVerifyUrl.ts, VerifyProofScreen.tsx, and now
// chainVerify.ts). Hoisted out of buildVerifyUrl.ts 2026-09-10 so a third
// caller didn't mean a third private copy.

/**
 * UTF-8-safe base64url encode. btoa only works on Latin-1 strings, so
 * encodeURIComponent handles UTF-8 first, then unescape collapses the
 * percent-encoded bytes back to Latin-1 for btoa to accept.
 */
export function base64UrlEncode(input: string): string {
  const utf8 = unescape(encodeURIComponent(input));
  const b64 = btoa(utf8);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Inverse of base64UrlEncode. Throws on malformed input (bad base64). */
export function base64UrlDecode(encoded: string): string {
  const padded = encoded
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(encoded.length + ((4 - (encoded.length % 4)) % 4), '=');
  const latin1 = atob(padded);
  return decodeURIComponent(escape(latin1));
}
