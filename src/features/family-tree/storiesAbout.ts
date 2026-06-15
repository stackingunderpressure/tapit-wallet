import type { Attestation, FieldBranch } from 'tapit-attest';
import { momentTimestamp } from '../journal/momentDate.ts';
import type { KinNode } from './kinGraph.ts';

function claimLeaf(att: Attestation, name: string): string {
  const claim = att.claim as FieldBranch;
  const node = claim.children.find((c) => c.name === name);
  return node && node.node === 'leaf' && typeof node.value === 'string'
    ? node.value
    : '';
}

// Family-tree render slice — the moments/stories ABOUT a person.
//
// A journal/story attestation is "about" a person via its subject. For a
// keyed person (their own wallet) the subject is their pubkey; for a
// keyless person (an ancestor like Pam, witnessed in) the subject is the
// typed display-name label the journal composer already supports. So
// "how she impacted you" = the journal entries whose subject matches the
// node. Name-matching for keyless people is honestly fragile (two people
// named the same collide); a later cut will let a story attach to a
// node_id directly. Until then this is the truthful join given today's
// data shape.

/** True when a journal attestation is about this person-node. */
export function isStoryAbout(att: Attestation, node: KinNode): boolean {
  if (att.kind !== 'journal') return false;
  // Robust link first: a subject_node leaf binding to this node's id (or
  // any pre-merge alias id that was fused into this canonical node).
  const subjectNode = claimLeaf(att, 'subject_node').trim();
  if (subjectNode.length > 0) {
    const ids = node.aliasIds ?? [node.id];
    return ids.includes(subjectNode);
  }
  // Legacy fallback: match by subject (keyed pubkey or name label).
  const subject = (att.subject ?? '').trim().toLowerCase();
  if (subject.length === 0) return false;
  if (node.keyedPubkey && subject === node.keyedPubkey.toLowerCase()) {
    return true;
  }
  return subject === node.displayName.trim().toLowerCase();
}

/**
 * Every journal/story attestation in holdings that is about this person,
 * newest moment first (by event date when set, else logged date).
 */
export function storiesAbout(
  holdings: readonly Attestation[],
  node: KinNode,
): Attestation[] {
  return holdings
    .filter((a) => isStoryAbout(a, node))
    .sort((a, b) => momentTimestamp(b) - momentTimestamp(a));
}
