import { decodeInvite, type InvitePayload } from './inviteLink.ts';

// sessionStorage bridge that carries a pending invite across the
// sign-in / onboarding page handoff. When someone opens a /join link
// without a wallet, they must first sign in (or onboard a fresh
// wallet), which navigates away from /join and — for the OTP magic-
// link path — reloads the page. The decoded invite needs to survive
// that so the wallet can complete the handshake-back once unlocked.
//
// Why sessionStorage is OK here when the onboarding bundle is NOT.
// The onboarding bundle holds the passphrase, which decrypts the
// keypair, so CLAUDE_ROOT.md #1 forbids persisting it anywhere — it
// stays module-memory only. An invite payload, by contrast, is
// entirely PUBLIC data: the founder's x-only public key, their
// display name, and a plaintext family name. None of it is a secret,
// so persisting it to sessionStorage (cleared when the tab closes,
// scoped to this origin) is safe and is what makes the new-user
// onboard-then-connect path possible at all.

const KEY = 'tapit-wallet:pending-invite';

/** Persist a decoded invite for consumption after sign-in. */
export function setPendingInvite(payload: InvitePayload): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Private mode / quota — non-fatal; the signed-in Accept path
    // still works, only the cross-onboarding bridge is lost.
  }
}

/**
 * Read + clear the pending invite in one call. Returns null when none
 * is stashed or the stored value fails to re-validate (tampered, stale
 * schema). Re-runs decodeInvite over the stored JSON so a corrupted
 * sessionStorage entry can never hand the caller a malformed payload.
 */
export function consumePendingInvite(): InvitePayload | null {
  if (typeof sessionStorage === 'undefined') return null;
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Re-encode-free re-validation: decodeInvite works on the b64url
    // wire form, but here we hold parsed JSON. Validate the shape the
    // same way by round-tripping the fields through a fresh object.
    return validate(parsed);
  } catch {
    return null;
  }
}

/** Cheap existence check with none of peekPendingInvite's JSON-parse
 *  + re-validate cost. Lets a caller (LoginPage) decide whether it's
 *  even worth lazy-loading the invite-banner UI, so the always-loaded
 *  login bundle isn't paying for that decision path on every visit —
 *  only the rare one where an invite is actually stashed. */
export function hasPendingInvite(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(KEY) != null;
  } catch {
    return false;
  }
}

/** Peek without clearing — used by the /join screen to decide whether
 *  a freshly-signed-in operator has an invite waiting. */
export function peekPendingInvite(): InvitePayload | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return validate(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return null;
  }
}

const HEX_64 = /^[0-9a-f]{64}$/i;

function validate(p: Record<string, unknown>): InvitePayload | null {
  if (p.v !== 1) return null;
  if (typeof p.founderPubkey !== 'string' || !HEX_64.test(p.founderPubkey)) {
    return null;
  }
  if (typeof p.founderName !== 'string' || p.founderName.trim().length === 0) {
    return null;
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

/** Convenience: decode a raw `i` param straight to a stashable payload.
 *  Returns null on any decode error (the /join screen surfaces the
 *  friendly message separately via decodeInvite's thrown error). */
export function decodeInviteParam(raw: string | null): InvitePayload | null {
  try {
    return decodeInvite(raw);
  } catch {
    return null;
  }
}
