// Pure helpers behind IdentityChip — kept in a sibling module so the
// chip component file exports only the React component (Fast Refresh
// constraint) and so the helpers stay unit-testable without mounting
// any React tree.

/**
 * Resolve a pubkey to a display name. Explicit `name` wins; lookup
 * map is consulted next; null when nothing matches. The IdentityChip
 * component uses the null return to fall back to the rendered string
 * 'Unknown', but the helper itself stays strict about whether a real
 * name was found so callers can branch on that.
 */
export function resolveDisplayName(
  pubkey: string,
  name?: string,
  namesByPubkey?: ReadonlyMap<string, string>,
): string | null {
  if (name && name.length > 0) return name;
  if (namesByPubkey) {
    const found = namesByPubkey.get(pubkey.toLowerCase());
    if (found && found.length > 0) return found;
  }
  return null;
}

export function shortKey(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}
