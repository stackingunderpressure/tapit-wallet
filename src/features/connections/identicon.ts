// Deterministic, no-network avatar derivation. Maps a pubkey (hex)
// to a hue pair and a two-character glyph that, together, make a
// visually-stable bubble per peer — no images fetched, no fonts
// loaded, no metadata leaked. The first appearance of a peer's
// pubkey in the operator's wallet produces the same avatar as
// every subsequent appearance, on every device they install on.
//
// Shipped as part of Cut 8 of the 2026-05-24 Fresh roadmap.

export interface IdenticonSeed {
  /** Hue 0-359 for the gradient start. */
  hueA: number;
  /** Hue 0-359 for the gradient end. */
  hueB: number;
  /** Two-character glyph rendered inside the bubble. */
  initials: string;
}

function hashHex(hex: string): number {
  let h = 2166136261; // FNV-1a 32-bit offset basis
  for (let i = 0; i < hex.length; i++) {
    h ^= hex.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function initialsFromName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return '';
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const a = parts[0]?.[0] ?? '';
    const b = parts[1]?.[0] ?? '';
    return (a + b).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

/**
 * Derive a stable identicon seed for a peer. `pubkey` drives the
 * colors; `displayName` (when provided) drives the glyph. Without
 * a display name, the first two hex characters of the pubkey
 * stand in — still recognisable across reloads even if anonymous.
 */
export function identiconSeed(
  pubkey: string,
  displayName?: string | null,
): IdenticonSeed {
  const h = hashHex(pubkey);
  const hueA = h % 360;
  const hueB = (h >>> 8) % 360;
  const initials = displayName
    ? initialsFromName(displayName) || pubkey.slice(0, 2).toUpperCase()
    : pubkey.slice(0, 2).toUpperCase();
  return { hueA, hueB, initials };
}
