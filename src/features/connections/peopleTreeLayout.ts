import type { Attestation } from 'tapit-attest';
import { envelopeId } from 'tapit-attest';
import {
  isFamilyRelationship,
  isHandshake,
  readHandshake,
} from './createHandshake.ts';
import { isMembership, readMembership } from './createMembership.ts';
import {
  familySignatureProgress,
  findFamilyUnitsForMember,
  readFamilyUnit,
} from './familyUnit.ts';

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
  /**
   * How this connection was verified — 'in-person' (the 3-QR exchange,
   * the strongest tie) or 'remote' (online-only, over Nostr). Drives the
   * edge weight on the tree: in-person edges render bold + solid,
   * remote edges thin + dashed. Empty string for legacy handshakes with
   * no verification leaf.
   */
  verification: string;
}

export interface TreeOrg {
  pubkey: string;
  name: string;
  angle: number;
}

export interface TreeFamily {
  /** Unique cryptographic identifier of the family-unit envelope. Used
   *  as the stable angle seed (the same operator might be in two
   *  families — birth family AND chosen family — and both must keep
   *  distinct positions across reloads). */
  envelopeId: string;
  familyName: string;
  /** Pubkey of the founding wallet. Carried so the tree can render a
   *  founder badge when the operator is the founder of the family. */
  founderId: string;
  memberCount: number;
  signedCount: number;
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
      verification: view.verification,
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

/**
 * Extract the family-units the operator is a member of, paired with
 * ratification progress and a stable angular position. A wallet can
 * belong to more than one family unit (birth family + chosen family),
 * and both surface here. Stable angle is seeded by the family-unit
 * envelope id (not the founder pubkey, because two families founded
 * by the same operator would collide on founder-hash). keyAliases
 * threads through to familySignatureProgress so the operator's own
 * signature counts even after key rotation — the genesis pubkey
 * stored in members[] differs from the active key that signs.
 */
export function extractFamilies(
  holdings: readonly Attestation[],
  myIdentity: string,
  keyAliases?: ReadonlyMap<string, readonly string[]>,
): TreeFamily[] {
  const units = findFamilyUnitsForMember(holdings, myIdentity);
  const out: TreeFamily[] = [];
  const seen = new Set<string>();
  for (const att of units) {
    const id = envelopeId(att);
    if (seen.has(id)) continue;
    seen.add(id);
    const view = readFamilyUnit(att);
    const progress = familySignatureProgress(att, keyAliases);
    out.push({
      envelopeId: id,
      familyName: view.familyName,
      founderId: view.founderId.toLowerCase(),
      memberCount: progress.total,
      signedCount: progress.signed,
      angle: angleFromPubkey(id),
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

/**
 * Color the family-unit-edge line. Shares the family peer-category
 * pink so the visual reads as "family-shaped relationship" across
 * both forms (a peer with relationship=spouse/child/etc. on the inner
 * ring, AND a multi-party family-unit envelope on the families ring).
 * The structural distinction lives in the radius + the node shape,
 * not the edge color.
 */
export const FAMILY_UNIT_EDGE_COLOR = CATEGORY_COLOR.family;
