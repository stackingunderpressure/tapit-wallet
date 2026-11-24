import type { RangedKey } from './freshAddressLeaf.ts';

// When is a vault-membership request "the same offer" as one already
// answered? (2026-11-24, operator: "Tried resending but tapit never seen it.
// I deleted original vault. Tried again nothing came".)
//
// Until now an offer was its vault + role, so a resend carrying something
// NEW -- a fresh-address vault's keys, without which Tapit cannot co-sign
// that vault's other addresses -- was dropped as "already accepted" while
// the old membership was held, and dropped for good once it was left.
// The operator chose: an exact repeat stays ignored; new content shows.
//
// The key keeps the old `<vault>::<role>` form for an offer with no
// fresh-address keys, so every entry already stored (declines, leaves,
// synced to the cloud backup) still suppresses exactly what it did. An
// offer WITH keys gets its own key, naming them.

export function offerKey(vaultDescriptor: string, role: string, rangedKeys?: readonly RangedKey[] | null): string {
  const base = `${vaultDescriptor}::${role}`;
  if (!rangedKeys?.length) return base;
  return `${base}::fresh:${[...new Set(rangedKeys.map((k) => k.xpub))].sort().join(',')}`;
}

/** Does a held membership already cover this request? Only if it carries
 *  every fresh-address key the request does (a request without keys is
 *  covered by any held membership for the vault, as before). */
export function heldCoversRequest(heldRangedKeys: readonly RangedKey[], requestRangedKeys?: readonly RangedKey[] | null): boolean {
  if (!requestRangedKeys?.length) return true;
  const held = new Set(heldRangedKeys.map((k) => `${k.xpub}|${k.key00.toLowerCase()}`));
  return requestRangedKeys.every((k) => held.has(`${k.xpub}|${k.key00.toLowerCase()}`));
}
