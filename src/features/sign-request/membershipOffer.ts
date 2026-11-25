import { sha256 } from '@noble/hashes/sha256';
import type { RangedKey } from './freshAddressLeaf.ts';

// When is a vault-membership request "the same offer" as one already
// answered? (2026-11-24, operator: "Tried resending but tapit never seen it.
// I deleted original vault. Tried again nothing came".)
//
// Until then an offer was its vault + role, so a resend carrying something
// NEW was dropped as "already accepted" while the old membership was held,
// and dropped for good once it was left. The operator chose: an exact
// repeat stays ignored; new content shows. New content is any of: the
// fresh-address keys, the review mode ('full' -- DynastyTrust
// docs/tapit-review-modes-build-note.md) and the vault's change list.
//
// The key keeps the old `<vault>::<role>` form for an offer with none of
// those, so every entry already stored (declines, leaves, synced to the
// cloud backup) still suppresses exactly what it did.

export interface OfferContent {
  rangedKeys?: readonly RangedKey[] | null;
  reviewMode?: 'wellness' | 'full' | null;
  changeScripts?: readonly string[] | null;
  wellnessPath?: boolean | null;
  circleKeys?: readonly string[] | null;
}

function changeTag(scripts: readonly string[]): string {
  const joined = [...scripts].map((s) => s.toLowerCase()).sort().join(',');
  return Array.from(sha256(new TextEncoder().encode(joined)).slice(0, 8)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function offerKey(vaultDescriptor: string, role: string, content: OfferContent = {}): string {
  const parts = [`${vaultDescriptor}::${role}`];
  if (content.rangedKeys?.length) parts.push(`fresh:${[...new Set(content.rangedKeys.map((k) => k.xpub))].sort().join(',')}`);
  if (content.reviewMode === 'full') parts.push('mode:full');
  if (content.wellnessPath) parts.push('wellness');
  if (content.circleKeys?.length) parts.push(`circle:${changeTag(content.circleKeys)}`);
  if (content.changeScripts?.length) parts.push(`change:${changeTag(content.changeScripts)}`);
  return parts.join('::');
}

/** Does a held membership already cover this request -- nothing in the
 *  request is new? A request with none of the new content is covered by any
 *  held membership for the vault, as before. */
export function heldCoversRequest(held: OfferContent, request: OfferContent): boolean {
  const heldKeys = new Set((held.rangedKeys ?? []).map((k) => `${k.xpub}|${k.key00.toLowerCase()}`));
  if (!(request.rangedKeys ?? []).every((k) => heldKeys.has(`${k.xpub}|${k.key00.toLowerCase()}`))) return false;
  if ((request.reviewMode ?? 'wellness') !== (held.reviewMode ?? 'wellness') && request.reviewMode !== undefined && request.reviewMode !== null) return false;
  if (request.wellnessPath && !held.wellnessPath) return false;
  const heldCircle = new Set((held.circleKeys ?? []).map((k) => k.toLowerCase()));
  if (!(request.circleKeys ?? []).every((k) => heldCircle.has(k.toLowerCase()))) return false;
  const heldChange = new Set((held.changeScripts ?? []).map((s) => s.toLowerCase()));
  return (request.changeScripts ?? []).every((s) => heldChange.has(s.toLowerCase()));
}
