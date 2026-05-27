import type { Attestation } from 'tapit-attest';
import {
  isFamilyRelationship,
  isHandshake,
  readHandshake,
} from './createHandshake.ts';
import { isMembership, readMembership } from './createMembership.ts';

// Pure layout math for the PeopleTree visualization (the operator's
// mycelium-tree vision from the 2026-05-27 ideas entry). Given the
// operator's holdings and identity, extract the set of handshake-known
// peers and the set of orgs they are a member of, classify each peer
// edge by relationship category, and compute deterministic radial
// positions so the same peer always lands in the same spot across
// reloads. All pure — testable without mounting a React tree, no I/O,
// no wallet calls, no time-of-day dependence.
//
// Layout pattern: operator at the canvas center, handshake peers on
// an inner ring, orgs the operator belongs to on an outer ring. Each
// peer's angle on its ring is derived from a hash of their pubkey
// (FNV-1a 32-bit, same hash the identicon module uses for color
// derivation), so the layout is stable across sessions and across
// devices for the same wallet. Different peers' hashes are well-
// distributed so the angular spread is approximately uniform without
// any explicit balancing.

export type PeerCategory =
  | 'family'
  | 'friend'
  | 'coworker'
  | 'acquaintance'
  | 'other';

export interface TreePeer {
  pubkey: string;
  name: string;
  category: PeerCategory;
  /** Angle on the ring in radians. Deterministic from pubkey hash. */
  angle: number;
}

export interface TreeOrg {
  pubkey: string;
  name: string;
  angle: number;
}

function hashHex(hex: string): number {
  // FNV-1a 32-bit — identical to the function in identicon.ts so the
  // tree positioning and the identicon coloring agree on what a
  // "stable hash of this pubkey" means.
  let h = 2166136261;
  for (let i = 0; i < hex.length; i++) {
    h ^= hex.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic angle in radians for a node on the ring. */
export function angleFromPubkey(pubkey: string): number {
  return (hashHex(pubkey.toLowerCase()) % 360) * (Math.PI / 180);
}

function categorize(relationship: string): PeerCategory {
  const r = relationship.trim().toLowerCase();
  if (isFamilyRelationship(r)) return 'family';
  if (r === 'friend') return 'friend';
  if (r === 'coworker') return 'coworker';
  if (r === 'acquaintance') return 'acquaintance';
  return 'other';
}

/**
 * Extract the unique handshake-known peers from holdings, paired with
 * their relationship category and stable angular position. Deduplicates
 * by pubkey when the operator has more than one handshake with the
 * same person (rare but possible).
 */
export function extractPeers(
  holdings: readonly Attestation[],
  myIdentity: string,
): TreePeer[] {
  const seen = new Set<string>();
  const out: TreePeer[] = [];
  const me = myIdentity.toLowerCase();
  for (const a of holdings) {
    if (!isHandshake(a)) continue;
    const view = readHandshake(a);
    let peer: { pubkey: string; name: string } | null = null;
    if (view.initiatorId.toLowerCase() === me) {
      if (view.responderId) {
        peer = { pubkey: view.responderId, name: view.responderName || '' };
      }
    } else if (view.responderId.toLowerCase() === me) {
      if (view.initiatorId) {
        peer = { pubkey: view.initiatorId, name: view.initiatorName || '' };
      }
    }
    if (!peer || !peer.pubkey) continue;
    const k = peer.pubkey.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      pubkey: k,
      name: peer.name,
      category: categorize(view.relationship),
      angle: angleFromPubkey(k),
    });
  }
  return out;
}

/**
 * Extract the unique orgs the operator is a member of, paired with
 * their stable angular position. Filters memberships down to those
 * where the operator is the member (not memberships the operator
 * issued as an org to others). Deduplicates by org pubkey.
 */
export function extractOrgs(
  holdings: readonly Attestation[],
  myIdentity: string,
): TreeOrg[] {
  const seen = new Set<string>();
  const out: TreeOrg[] = [];
  const me = myIdentity.toLowerCase();
  for (const a of holdings) {
    if (!isMembership(a)) continue;
    const view = readMembership(a);
    if (view.memberId.toLowerCase() !== me) continue;
    if (!view.orgId) continue;
    const k = view.orgId.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      pubkey: k,
      name: view.orgName || '',
      angle: angleFromPubkey(k),
    });
  }
  return out;
}

/** Polar-to-cartesian conversion for a node on a ring of the given radius. */
export function ringPosition(
  centerX: number,
  centerY: number,
  radius: number,
  angle: number,
): { x: number; y: number } {
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle),
  };
}

/** Color the peer-edge line for each relationship category. */
export const CATEGORY_COLOR: Record<PeerCategory, string> = {
  family: '#e94f6f',
  friend: '#4f8be9',
  coworker: '#7a7a7a',
  acquaintance: '#a8a8a8',
  other: '#c8c8c8',
};

/** Color the org-edge line (separate from peer categories). */
export const ORG_EDGE_COLOR = '#7c3aed';
