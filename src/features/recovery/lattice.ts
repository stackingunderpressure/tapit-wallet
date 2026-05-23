import type { Attestation } from 'tapit-attest';
import { isHandshake, readHandshake } from '../connections/createHandshake.ts';
import { isMembership, readMembership } from '../connections/createMembership.ts';
import { findLatestCohort, readCohort, type CohortMember } from './createCohort.ts';

// Phase 5e-iv — lattice data extraction. Pure functions over the
// operator's holdings that produce the unified "your network" view
// the LatticePanel renders. No React, no transport, no signing —
// just reads what's already signed and held and groups it.
//
// The hyphal lattice in MYCELIUM_NETWORK_SPEC.md is the layer where
// individual handshakes, memberships, and the recovery cohort
// resolve into the operator's verifiable web of connections. This
// module surfaces that web in one read so a single screen can show
// it.

export interface PeerNode {
  /** Counterpart's pubkey (always lowercase hex). */
  pubkey: string;
  /** Display name from whichever signed leaf surfaced it. */
  name: string;
  /** True when at least one Tier P (in-person) handshake exists with this peer. */
  inPerson: boolean;
  /** True when at least one Tier R (remote) link exists with this peer. */
  remote: boolean;
  /** True when this peer is named in the operator's current recovery cohort. */
  inCohort: boolean;
  /** When the wallet first connected with them (earliest handshake issuedAt). */
  firstSeen: string | null;
}

export interface OrgNode {
  /** Org pubkey. */
  orgId: string;
  /** Org name as it appears in the membership leaf. */
  orgName: string;
  /** Issue date of the membership credential. */
  issuedAt: string;
}

export interface CohortSnapshot {
  declared: boolean;
  threshold: number;
  totalShares: number;
  declaredAt: string;
  members: CohortMember[];
}

export interface LatticeView {
  peers: PeerNode[];
  organizations: OrgNode[];
  cohort: CohortSnapshot;
  /** Quick totals for the summary header. */
  totals: {
    tierPCount: number;
    tierRCount: number;
    orgsCount: number;
    cohortCount: number;
  };
}

/**
 * Walk the holdings and return the unified lattice view. The
 * operator's identity is needed to filter their side of mutual
 * handshakes and to filter memberships to ones THEY hold (rather
 * than ones they've issued as an org).
 */
export function buildLatticeView(
  holdings: readonly Attestation[],
  walletIdentity: string,
): LatticeView {
  const peerMap = new Map<string, PeerNode>();

  for (const att of holdings) {
    if (!isHandshake(att)) continue;
    const v = readHandshake(att);
    const tier = v.verification === 'in-person' ? 'P' : 'R';
    // The counterpart is whichever side of the handshake is NOT the
    // operator. Handshakes are mutually signed, so the operator may
    // appear as either initiator or responder.
    const counterpartId =
      v.initiatorId === walletIdentity ? v.responderId : v.initiatorId;
    const counterpartName =
      v.initiatorId === walletIdentity ? v.responderName : v.initiatorName;
    if (!counterpartId) continue;
    const key = counterpartId.toLowerCase();
    const existing = peerMap.get(key);
    if (!existing) {
      peerMap.set(key, {
        pubkey: key,
        name: counterpartName || 'Unknown',
        inPerson: tier === 'P',
        remote: tier === 'R',
        inCohort: false,
        firstSeen: v.handshakeAt || null,
      });
    } else {
      if (tier === 'P') existing.inPerson = true;
      if (tier === 'R') existing.remote = true;
      // Earliest handshake wins for firstSeen.
      if (v.handshakeAt && (!existing.firstSeen || v.handshakeAt < existing.firstSeen)) {
        existing.firstSeen = v.handshakeAt;
      }
    }
  }

  // Mark cohort membership across the peer map.
  const latestCohortAtt = findLatestCohort(holdings, walletIdentity);
  const cohortView = latestCohortAtt ? readCohort(latestCohortAtt) : null;
  if (cohortView) {
    for (const m of cohortView.members) {
      const key = m.pubkey.toLowerCase();
      const existing = peerMap.get(key);
      if (existing) {
        existing.inCohort = true;
      } else {
        // Cohort member without a handshake on file — surface them
        // anyway so the operator sees them in the lattice.
        peerMap.set(key, {
          pubkey: key,
          name: m.name || 'Unknown',
          inPerson: false,
          remote: false,
          inCohort: true,
          firstSeen: null,
        });
      }
    }
  }

  // Organizations: memberships held BY this wallet (the operator is
  // the named member). Filters out memberships the wallet ISSUED as
  // an org — those are listed on the Identity tab separately.
  const orgs: OrgNode[] = [];
  for (const att of holdings) {
    if (!isMembership(att)) continue;
    const v = readMembership(att);
    if (v.memberId !== walletIdentity) continue;
    orgs.push({ orgId: v.orgId, orgName: v.orgName || 'Unknown', issuedAt: v.issuedAt });
  }
  orgs.sort((a, b) => a.orgName.localeCompare(b.orgName));

  const peers = Array.from(peerMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  const cohort: CohortSnapshot = cohortView
    ? {
        declared: true,
        threshold: cohortView.threshold,
        totalShares: cohortView.totalShares,
        declaredAt: cohortView.declaredAt,
        members: cohortView.members,
      }
    : {
        declared: false,
        threshold: 0,
        totalShares: 0,
        declaredAt: '',
        members: [],
      };

  return {
    peers,
    organizations: orgs,
    cohort,
    totals: {
      tierPCount: peers.filter((p) => p.inPerson).length,
      tierRCount: peers.filter((p) => p.remote).length,
      orgsCount: orgs.length,
      cohortCount: cohort.members.length,
    },
  };
}
