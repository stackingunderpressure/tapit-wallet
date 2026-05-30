import type { Attestation } from 'tapit-attest';
import { isHandshake, readHandshake } from './createHandshake.ts';
import { isFamilyUnit, readFamilyUnit } from './familyUnit.ts';
import { isRecoveryCohort, readCohort } from '../recovery/createCohort.ts';

// Item 11 sub-cut A (2026-05-29) — the peer-picker substrate.
// Surfaces the operator's existing trust networks (family-unit
// members, recovery-cohort members, handshake peers) as the
// candidate pool for the peer-mediated identity gate (PLAN.md
// Founding Vision section).
//
// Doesn't yet do anything with selections — the next sub-cuts
// compose the gate, the release ceremony, the verifier wrapper
// against the persisted picks. This helper is the bootstrap step:
// surface the "people who could vouch for you" pool from
// relationships the operator has already curated.
//
// Returns one row per unique peer pubkey with the set of sources
// they appear in. A peer who is in your family AND your recovery
// cohort AND a handshake peer shows up once with three source
// badges, not three times. Names are sourced in priority order
// (family > cohort > handshake) so the most-meaningful name wins
// when duplicates appear.

export type VouchingSource = 'family' | 'cohort' | 'handshake';

export interface VouchingCandidate {
  pubkey: string;
  name: string;
  sources: readonly VouchingSource[];
}

interface Accumulator {
  name: string;
  /** Priority of the current name — lower wins. */
  namePriority: number;
  sources: Set<VouchingSource>;
}

const NAME_PRIORITY: Record<VouchingSource, number> = {
  family: 0,
  cohort: 1,
  handshake: 2,
};

function record(
  acc: Map<string, Accumulator>,
  pubkey: string,
  name: string,
  source: VouchingSource,
): void {
  const lower = pubkey.toLowerCase();
  const existing = acc.get(lower);
  if (existing) {
    existing.sources.add(source);
    if (NAME_PRIORITY[source] < existing.namePriority && name.trim()) {
      existing.name = name.trim();
      existing.namePriority = NAME_PRIORITY[source];
    }
    return;
  }
  acc.set(lower, {
    name: name.trim() || pubkey.slice(0, 8),
    namePriority: NAME_PRIORITY[source],
    sources: new Set([source]),
  });
}

export function findVouchingCircleCandidates(
  holdings: readonly Attestation[],
  myKey: string,
): readonly VouchingCandidate[] {
  const acc = new Map<string, Accumulator>();
  const myKeyLower = myKey.toLowerCase();

  // Family-unit members — operator is one of the members; the
  // OTHERS in each family unit they are named in are vouching
  // candidates.
  for (const att of holdings) {
    if (!isFamilyUnit(att)) continue;
    const view = readFamilyUnit(att);
    const namedIsMe = view.members.some(
      (m) => m.pubkey.toLowerCase() === myKeyLower,
    );
    if (!namedIsMe) continue;
    for (const member of view.members) {
      if (member.pubkey.toLowerCase() === myKeyLower) continue;
      record(acc, member.pubkey, member.name, 'family');
    }
  }

  // Recovery cohort — operator declared the cohort members; they
  // are vouching candidates by definition.
  for (const att of holdings) {
    if (!isRecoveryCohort(att)) continue;
    const view = readCohort(att);
    for (const member of view.members) {
      if (member.pubkey.toLowerCase() === myKeyLower) continue;
      record(acc, member.pubkey, member.name, 'cohort');
    }
  }

  // Handshake peers — every counter-party with whom the operator
  // has a relationship attestation is a vouching candidate.
  for (const att of holdings) {
    if (!isHandshake(att)) continue;
    const view = readHandshake(att);
    const peerPubkey =
      view.initiatorId.toLowerCase() === myKeyLower
        ? view.responderId
        : view.initiatorId;
    const peerName =
      view.initiatorId.toLowerCase() === myKeyLower
        ? view.responderName
        : view.initiatorName;
    if (peerPubkey.toLowerCase() === myKeyLower) continue;
    record(acc, peerPubkey, peerName, 'handshake');
  }

  // Stable output order: alphabetic by name with pubkey as tiebreaker
  // so the UI renders the same list every render given the same
  // holdings.
  return Array.from(acc.entries())
    .map(([pubkey, entry]) => ({
      pubkey,
      name: entry.name,
      sources: Array.from(entry.sources).sort() as readonly VouchingSource[],
    }))
    .sort((a, b) => {
      const byName = a.name.localeCompare(b.name);
      if (byName !== 0) return byName;
      return a.pubkey.localeCompare(b.pubkey);
    });
}
