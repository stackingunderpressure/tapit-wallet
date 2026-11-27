import { envelopeId, verifyEnvelope, type Attestation } from 'tapit-attest';
import { leafValue } from './createHandshake.ts';
import {
  buildFamilyUnitDraft,
  isFamilyUnit,
  memberHasSigned,
  readFamilyUnit,
  type FamilyMember,
} from './familyUnit.ts';

// Family amendments (operator, 2026-11-27): "setting up family it's open
// till we the family agree it is complete. Say a grand child grows up
// family accepts them in."
//
// A family_unit envelope is immutable -- its envelopeId is the digest,
// so changing the roster mints a new envelope and the signatures on the
// old one cannot carry over. Before this module, that meant the roster
// LOCKED the moment anyone but the founder signed. An amendment is a NEW
// version of the family that points back at the one it replaces:
//
//   family_line     envelopeId of version 1 -- the stable family id
//   supersedes      envelopeId of the version this one replaces
//   family_version  2, 3, ... (version 1 carries none of these leaves)
//   admits          JSON array of the pubkeys this version adds
//   founded_at      copied from the version it replaces, so the family's
//                   founding date never moves
//
// Operator rules, chosen 2026-11-27:
//   - Only the founder proposes an amendment (the envelope subject stays
//     the founder, so the existing envelopeRoute cosign loop is unchanged).
//   - It takes effect when MORE THAN HALF of the members it carries over
//     have signed it AND every person it admits has signed it -- nobody
//     is written into a family without their own consent.
//   - Until then the version it replaces stays the family in effect, and
//     nobody's earlier signature is lost.
//
// Additions only. Removing someone (a divorce, a death) is deliberately
// NOT expressible here: a version whose carried-over roster differs from
// its predecessor is rejected by resolveFamilyLines when the predecessor
// is held, and buildFamilyAmendment only ever appends.
//
// What this cannot see: a member who rotated keys signs with a key that
// is not the pubkey stored in members[], and is counted only when the
// caller passes a keyAliases bridge for them -- the same limit
// familySignatureProgress has. A remote member's rotation therefore
// makes the majority harder to reach, never easier. And a device that
// holds an amendment without its predecessor (a newly admitted
// grandchild) cannot check the carried-over roster against it; it trusts
// the version's own admits list, which the founder signed.

export interface FamilyVersionInfo {
  /** Stable id of the family: envelopeId of version 1. */
  line: string;
  /** 1 for an original family; 2+ for an amendment. */
  version: number;
  /** envelopeId this version replaces, or null for version 1. */
  supersedes: string | null;
  /** Lowercased pubkeys this version adds. Empty for version 1. */
  admits: string[];
}

const HEX_64 = /^[0-9a-f]{64}$/i;

export function familyVersionInfo(att: Attestation): FamilyVersionInfo {
  const line = leafValue(att, 'family_line').toLowerCase();
  const supersedes = leafValue(att, 'supersedes').toLowerCase();
  const version = Number(leafValue(att, 'family_version'));
  if (!line || !supersedes || !Number.isInteger(version) || version < 2) {
    return { line: envelopeId(att), version: 1, supersedes: null, admits: [] };
  }
  let admits: string[] = [];
  try {
    const raw: unknown = JSON.parse(leafValue(att, 'admits') || '[]');
    if (Array.isArray(raw)) {
      admits = raw
        .filter((k): k is string => typeof k === 'string' && HEX_64.test(k))
        .map((k) => k.toLowerCase());
    }
  } catch {
    admits = [];
  }
  return { line, version, supersedes, admits };
}

/**
 * Build the unsigned next version of `current` with `newMembers`
 * appended. Founder-only, additions-only. The caller signs, holds,
 * anchors and sends it exactly like any other family envelope, and must
 * NOT unhold `current` -- it stays the family in effect until this
 * version has its signatures.
 */
export function buildFamilyAmendment(
  founder: Attestation,
  current: Attestation,
  newMembers: readonly FamilyMember[],
): Attestation {
  if (!isFamilyUnit(current)) throw new Error('not a family unit');
  const view = readFamilyUnit(current);
  if (view.founderId.toLowerCase() !== founder.subject.toLowerCase()) {
    throw new Error('only the founder can propose adding someone to this family');
  }
  if (newMembers.length === 0) throw new Error('add at least one person');
  const info = familyVersionInfo(current);
  const members: FamilyMember[] = view.members.map((m) => ({
    pubkey: m.pubkey,
    name: m.name,
    role: m.role,
    ...(m.as_of ? { as_of: m.as_of } : {}),
  }));
  const admits: string[] = [];
  for (const n of newMembers) {
    const pk = n.pubkey.toLowerCase();
    members.push({
      pubkey: pk,
      name: n.name,
      role: n.role,
      ...(n.as_of ? { as_of: n.as_of } : {}),
    });
    admits.push(pk);
  }
  // buildFamilyUnitDraft rejects duplicates, bad hex and unknown roles.
  return buildFamilyUnitDraft(founder, view.familyName, members, {
    family_line: info.line,
    supersedes: envelopeId(current),
    family_version: String(info.version + 1),
    admits: JSON.stringify(admits),
    founded_at: view.foundedAt || new Date().toISOString(),
  });
}

export interface AmendmentProgress {
  /** Members carried over from the previous version. */
  priorTotal: number;
  priorSigned: number;
  /** Smallest count that is more than half of priorTotal. */
  priorNeeded: number;
  admitsTotal: number;
  admitsSigned: number;
  /** Lowercased pubkeys of admitted people who have not signed yet. */
  admitsAwaiting: string[];
  inEffect: boolean;
}

/** Signers whose signature actually verifies against this envelope. */
function verifiedSigners(att: Attestation): Set<string> {
  const out = new Set<string>();
  try {
    for (const s of verifyEnvelope(att).signers) {
      if (s.valid) out.add(s.signer.toLowerCase());
    }
  } catch {
    // An envelope that cannot be verified counts nobody.
  }
  return out;
}

/**
 * Where an amendment stands against the agreement rule. Counts only
 * signatures that verify. Version 1 is always in effect -- the original
 * family never needed a majority, and changing that now would make
 * every existing family vanish from the phones it is on.
 */
export function amendmentProgress(
  att: Attestation,
  keyAliases?: ReadonlyMap<string, readonly string[]>,
): AmendmentProgress {
  const info = familyVersionInfo(att);
  const view = readFamilyUnit(att);
  const signers = verifiedSigners(att);
  const admitted = new Set(info.admits);
  const prior = view.members.filter((m) => !admitted.has(m.pubkey.toLowerCase()));
  const priorSigned = prior.filter((m) => memberHasSigned(m.pubkey, signers, keyAliases)).length;
  const priorNeeded = Math.floor(prior.length / 2) + 1;
  const admitsAwaiting = info.admits.filter((pk) => !memberHasSigned(pk, signers, keyAliases));
  const admitsSigned = info.admits.length - admitsAwaiting.length;
  const inEffect =
    info.version === 1 ||
    (prior.length > 0 &&
      admitsAwaiting.length === 0 &&
      info.admits.length > 0 &&
      priorSigned >= priorNeeded);
  return {
    priorTotal: prior.length,
    priorSigned,
    priorNeeded,
    admitsTotal: info.admits.length,
    admitsSigned,
    admitsAwaiting,
    inEffect,
  };
}

export interface ResolvedFamily {
  line: string;
  /** The version in effect, or null when this device only holds a
   *  proposal (e.g. a grandchild whose admission is still pending). */
  current: Attestation | null;
  /** A newer version still collecting signatures, if one is held. */
  proposal: Attestation | null;
}

/** Same founder, next version number, and the carried-over roster is
 *  exactly the predecessor's roster. */
function consistentWith(next: Attestation, prev: Attestation): boolean {
  const ni = familyVersionInfo(next);
  const pi = familyVersionInfo(prev);
  if (ni.version !== pi.version + 1) return false;
  if (ni.supersedes !== envelopeId(prev).toLowerCase()) return false;
  const nv = readFamilyUnit(next);
  const pv = readFamilyUnit(prev);
  if (nv.founderId.toLowerCase() !== pv.founderId.toLowerCase()) return false;
  if (next.subject.toLowerCase() !== prev.subject.toLowerCase()) return false;
  const admitted = new Set(ni.admits);
  const carried = nv.members
    .map((m) => m.pubkey.toLowerCase())
    .filter((k) => !admitted.has(k))
    .sort();
  const before = pv.members.map((m) => m.pubkey.toLowerCase()).sort();
  return carried.length === before.length && carried.every((k, i) => k === before[i]);
}

/**
 * Collapse every held family envelope into one entry per family: the
 * version in effect, plus any newer proposal. Callers render
 * `current ?? proposal` as the family, so a phone holding two versions
 * shows one family, not two.
 */
export function resolveFamilyLines(
  units: readonly Attestation[],
  keyAliases?: ReadonlyMap<string, readonly string[]>,
): ResolvedFamily[] {
  const byLine = new Map<string, Map<string, Attestation>>();
  const order: string[] = [];
  for (const att of units) {
    if (!isFamilyUnit(att)) continue;
    const { line } = familyVersionInfo(att);
    let group = byLine.get(line);
    if (!group) {
      group = new Map();
      byLine.set(line, group);
      order.push(line);
    }
    const id = envelopeId(att).toLowerCase();
    const existing = group.get(id);
    // Same envelope held twice: keep the copy with more signatures.
    if (!existing || att.signatures.length > existing.signatures.length) {
      group.set(id, att);
    }
  }

  const out: ResolvedFamily[] = [];
  for (const line of order) {
    const group = byLine.get(line)!;
    const versions = [...group.values()].sort(
      (a, b) => familyVersionInfo(b).version - familyVersionInfo(a).version,
    );
    // A version is acceptable when it is in effect and, if its
    // predecessor is held, consistent with it. Walking newest-first,
    // the first acceptable one whose chain back is also acceptable wins.
    const acceptable = (att: Attestation, depth = 0): boolean => {
      if (depth > 64) return false;
      if (!amendmentProgress(att, keyAliases).inEffect) return false;
      const info = familyVersionInfo(att);
      if (!info.supersedes) return true;
      const prev = group.get(info.supersedes);
      if (!prev) return true; // predecessor not held -- see header
      return consistentWith(att, prev) && acceptable(prev, depth + 1);
    };
    const current = versions.find((v) => acceptable(v)) ?? null;
    const currentVersion = current ? familyVersionInfo(current).version : 0;
    const currentId = current ? envelopeId(current).toLowerCase() : null;
    const proposal =
      versions.find((v) => {
        const info = familyVersionInfo(v);
        if (info.version <= currentVersion) return false;
        if (amendmentProgress(v, keyAliases).inEffect) return false;
        if (currentId === null) return true;
        return info.supersedes === currentId && consistentWith(v, current!);
      }) ?? null;
    if (current || proposal) out.push({ line, current, proposal });
  }
  return out;
}
