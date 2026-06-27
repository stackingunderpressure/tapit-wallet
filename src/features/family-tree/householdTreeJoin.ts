import type { Attestation } from 'tapit-attest';
import { envelopeId } from 'tapit-attest';
import { isPersonNode, readPersonNode } from './personNode.ts';

// Household ↔ tree join (one super Family tab, Tier 1 — 2026-06-26).
//
// The wallet holds family in two models that never referenced each other:
// the co-signed HOUSEHOLD (connections/familyUnit.ts — members keyed by
// pubkey, the signed agreement) and the genealogy TREE (person-nodes,
// keyless-allowed, the map). They were declared separately, so a keyed
// living person had to be entered twice. The de-dup plan
// (docs/family-tab-unification.md) noted the two models already share a
// join key: a household member's `pubkey` equals a person-node's
// `keyed_pubkey`, both the genesis identity lowercased. This module is the
// pure read-side join over that key — no signed format changes, no I/O.
//
// It answers one question per household member: "is this person already a
// node in my tree?" — so the Household view can show an "in your tree" badge
// or offer to add the missing ones, killing the double-entry friction.

/**
 * Index every KEYED person-node in holdings by its keyed pubkey
 * (lowercased) → the node's id (envelopeId). Keyless nodes (most
 * ancestors) carry no pubkey and are skipped — they can never match a
 * household member, who is keyed by definition.
 *
 * If two keyed nodes share a pubkey (a pre-merge duplicate the same_as
 * cut would later fuse), the last one wins; existence is all the callers
 * need, and the canonical id is resolved by the tree's own merge logic.
 */
export function keyedNodeIndex(
  holdings: readonly Attestation[],
): Map<string, string> {
  const index = new Map<string, string>();
  for (const att of holdings) {
    if (!isPersonNode(att)) continue;
    const view = readPersonNode(att);
    if (view.keyedPubkey) {
      index.set(view.keyedPubkey.toLowerCase(), envelopeId(att));
    }
  }
  return index;
}

/**
 * The tree person-node id for a household member's pubkey, or undefined
 * when that person is not yet in the tree. Case-insensitive on the
 * pubkey so callers don't have to normalize first.
 */
export function treeNodeForPubkey(
  index: ReadonlyMap<string, string>,
  pubkey: string,
): string | undefined {
  return index.get(pubkey.toLowerCase());
}
