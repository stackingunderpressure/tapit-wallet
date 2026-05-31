// Shareable join-link codec. A founder generates a link that carries
// THEIR pubkey + display name (and optionally a family name). Whoever
// opens it — already a Tapit user, or brand new — ends up
// remote-handshaking back to the founder, and when a family was named
// the founder gets prompted to add the new connection to it.
//
// The crucial property: the payload carries only PUBLIC data — the
// founder's pubkey (an x-only public key), their chosen display name,
// and a plaintext family name. No secret ever rides an invite link.
// That is what lets the link survive an sessionStorage bridge across
// the new-user onboarding page handoff (pendingInvite.ts), unlike the
// onboarding bundle which holds the passphrase and must stay
// module-memory only (CLAUDE_ROOT.md #1).
//
// Encoding mirrors the sign-request `req` codec: base64url of JSON,
// carried in a `?i=` query param on the /join route. Decode is
// intentionally strict — a malformed link yields a typed error the
// /join screen renders as "this invite link is not valid" rather than
// throwing into a blank page.

const HEX_64 = /^[0-9a-f]{64}$/i;

export interface InvitePayload {
  /** Schema version so a future shape change can be detected and
   *  rejected with a friendly "update your app" message rather than
   *  mis-parsed. v1 is the only version today. */
  v: 1;
  /** The founder's x-only pubkey (64-char hex). The invitee
   *  remote-handshakes to this. */
  founderPubkey: string;
  /** The founder's display name at link-generation time — shown on
   *  the /join screen so the invitee sees who invited them. Display
   *  only; the cryptographic identity is founderPubkey. */
  founderName: string;
  /** Optional family name. When present, the /join flow offers to add
   *  the new connection to this family after the handshake completes.
   *  Plaintext label only — the family envelope itself is built and
   *  signed founder-side, never carried in the link. */
  familyName?: string;
}

export class InviteLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InviteLinkError';
  }
}

function b64UrlEncode(s: string): string {
  // btoa over a UTF-8-safe byte string, then base64url-ize.
  const bytes = new TextEncoder().encode(s);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64UrlDecode(input: string): string {
  const s = input.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/**
 * Encode an invite payload to the `i` query-param value. Validates the
 * founder pubkey is 64-char hex and the name is non-empty so a bad
 * link can never be minted. familyName is trimmed; an empty/whitespace
 * familyName is dropped entirely (a wallet-only invite).
 */
export function encodeInvite(input: {
  founderPubkey: string;
  founderName: string;
  familyName?: string;
}): string {
  if (!HEX_64.test(input.founderPubkey)) {
    throw new InviteLinkError('founderPubkey must be 64-char hex');
  }
  const founderName = input.founderName.trim();
  if (founderName.length === 0) {
    throw new InviteLinkError('founderName must not be empty');
  }
  const familyName = input.familyName?.trim();
  const payload: InvitePayload = {
    v: 1,
    founderPubkey: input.founderPubkey.toLowerCase(),
    founderName,
    ...(familyName ? { familyName } : {}),
  };
  return b64UrlEncode(JSON.stringify(payload));
}

/**
 * Decode + validate an `i` query-param value into an InvitePayload.
 * Throws InviteLinkError on every malformed-input path so callers can
 * render one friendly message. Never throws a raw SyntaxError/
 * DOMException into the UI.
 */
export function decodeInvite(raw: string | null | undefined): InvitePayload {
  if (!raw || raw.trim().length === 0) {
    throw new InviteLinkError('invite link is empty');
  }
  let json: string;
  try {
    json = b64UrlDecode(raw.trim());
  } catch {
    throw new InviteLinkError('invite link is not valid base64');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new InviteLinkError('invite link is not valid JSON');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new InviteLinkError('invite link is not an object');
  }
  const p = parsed as Record<string, unknown>;
  if (p.v !== 1) {
    throw new InviteLinkError(
      'this invite link was made by a newer version of the app — update and try again',
    );
  }
  if (typeof p.founderPubkey !== 'string' || !HEX_64.test(p.founderPubkey)) {
    throw new InviteLinkError('invite link is missing a valid founder key');
  }
  if (typeof p.founderName !== 'string' || p.founderName.trim().length === 0) {
    throw new InviteLinkError('invite link is missing the inviter name');
  }
  const familyName =
    typeof p.familyName === 'string' && p.familyName.trim().length > 0
      ? p.familyName.trim()
      : undefined;
  return {
    v: 1,
    founderPubkey: p.founderPubkey.toLowerCase(),
    founderName: p.founderName.trim(),
    ...(familyName ? { familyName } : {}),
  };
}

/**
 * Build the full shareable URL for an invite. Origin comes from the
 * caller (window.location.origin) so the link points at wherever the
 * wallet is actually hosted.
 */
export function buildInviteUrl(origin: string, payload: {
  founderPubkey: string;
  founderName: string;
  familyName?: string;
}): string {
  return `${origin}/join?i=${encodeInvite(payload)}`;
}
