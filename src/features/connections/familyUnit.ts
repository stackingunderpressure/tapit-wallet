import type { Attestation } from 'tapit-attest';
import { credentialAttestation } from 'tapit-attest';
import { displayNameOf, leafValue } from './createHandshake.ts';

// Family-mode substrate (operator authorization 2026-05-27). A family
// is a multi-party signed unit where every member is named with their
// pubkey, display name, role, and optional backdated "as_of" date —
// the actual date that member joined the family (a kid's birth date,
// a spouse's wedding date, etc.) which can sit in the past even
// though the envelope is being signed today. The whole family co-
// signs ONE credential-kind attestation; every member's wallet ends
// up holding the same envelope, so each person's wallet has the full
// family graph available for downstream rendering (PeopleTree v2 will
// branch a family node into its members; tap-for-detail will show
// who else is in your family from any one member's chip).
//
// The on-wire shape mirrors officialsRoster.ts's approach: the
// member list is a single JSON-encoded leaf rather than N parallel
// leaves, which keeps the Merkle tree shape constant regardless of
// family size and matches the proven pattern Phase 8 Phase B
// disclosure-proof verifiers already understand. Roles are a closed
// vocabulary so consumers can render them with confidence — dad and
// mom are the operator's named framing, plus the gender-neutral
// 'parent' for households that prefer it, plus 'spouse' / 'child' /
// 'sibling' to cover the rest of the immediate-family relationships
// the FAMILY_RELATIONSHIPS vocabulary in createHandshake.ts already
// recognizes.
//
// This cut ships data substrate only — builder + reader + predicate
// + signature-progress + lookup helpers + tests. The form-a-family
// UI and the on-wire ratification routing (founder signs first, ships
// to each member, each member signs and returns, founder absorbs)
// reuse the existing cosigning + Mycelium transport patterns and ship
// in the next cut. The tree-v2 rendering that consumes the family
// graph ships in the cut after that.

/** Closed vocabulary of family roles. */
export const FAMILY_ROLES = [
  'dad',
  'mom',
  'parent',
  'spouse',
  'child',
  'sibling',
] as const;

export type FamilyRole = (typeof FAMILY_ROLES)[number];

export interface FamilyMember {
  /** 64-char hex pubkey of the member's wallet. */
  pubkey: string;
  /** Display name at the moment the family unit was drafted. */
  name: string;
  /** Closed-vocabulary role. */
  role: FamilyRole;
  /** Optional ISO date (YYYY-MM-DD or full ISO) for when this member
   *  joined the family — a child's birthday, a spouse's marriage date.
   *  Backdated freely: the envelope is signed today but the date
   *  recorded here can be any past (or future, for a planned arrival)
   *  date. Empty / absent when not specified. */
  as_of?: string;
}

export interface FamilyUnit {
  /** Optional display label for the family (e.g. "The Winchesters"). */
  familyName: string;
  /** All named members, in the order the builder accepted them. */
  members: FamilyMember[];
  /** ISO timestamp the envelope was drafted at. */
  foundedAt: string;
  /** Pubkey of the founder (subject of the envelope). */
  founderId: string;
  /** Founder's display name at draft time. */
  founderName: string;
}

function isFamilyRole(value: unknown): value is FamilyRole {
  return (
    typeof value === 'string' &&
    (FAMILY_ROLES as readonly string[]).includes(value)
  );
}

const HEX_64 = /^[0-9a-f]{64}$/i;

/** True when an attestation is a family-unit credential. */
export function isFamilyUnit(att: Attestation): boolean {
  return (
    att.kind === 'credential' &&
    leafValue(att, 'credential_type') === 'family_unit'
  );
}

/**
 * Build the unsigned family-unit draft. Validates structurally before
 * encoding so an invalid family is caught at draft time rather than
 * at signature-verification time downstream:
 *
 * - at least one member,
 * - founder's pubkey is present in the member list,
 * - every member's pubkey is 64-char hex,
 * - no duplicate pubkeys,
 * - every member's role is in the closed vocabulary.
 *
 * The founder signs this draft to produce the first-signed envelope;
 * each other named member's wallet co-signs to fill in their slot.
 * familySignersComplete(att) returns true once every member's
 * signature has landed.
 */
export function buildFamilyUnitDraft(
  founder: Attestation,
  familyName: string,
  members: FamilyMember[],
): Attestation {
  if (members.length === 0) {
    throw new Error('family unit must name at least one member');
  }
  const founderLower = founder.subject.toLowerCase();
  const seen = new Set<string>();
  for (const m of members) {
    if (!HEX_64.test(m.pubkey)) {
      throw new Error(`member pubkey is not 64-char hex: ${m.pubkey}`);
    }
    const k = m.pubkey.toLowerCase();
    if (seen.has(k)) {
      throw new Error(`duplicate member pubkey: ${m.pubkey}`);
    }
    seen.add(k);
    if (!isFamilyRole(m.role)) {
      throw new Error(`invalid family role: ${m.role}`);
    }
  }
  if (!seen.has(founderLower)) {
    throw new Error('founder must be listed as a family member');
  }
  const fields: Record<string, string> = {
    credential_type: 'family_unit',
    family_name: familyName,
    members: JSON.stringify(
      members.map((m) => ({
        pubkey: m.pubkey.toLowerCase(),
        name: m.name,
        role: m.role,
        as_of: m.as_of || '',
      })),
    ),
    founded_at: new Date().toISOString(),
    founder_id: founder.subject,
    founder_name: displayNameOf(founder),
  };
  return credentialAttestation({
    subject: founder.subject,
    tier: 'notable',
    fields,
  });
}

/**
 * Read a family-unit credential's fields into a plain view. Shape-
 * tolerant: malformed entries in the members JSON are individually
 * dropped (matching officialsRoster.readOfficials's behaviour) so a
 * single bad entry does not blank the whole list. Returns an empty
 * members array when the leaf is missing or non-JSON.
 */
export function readFamilyUnit(att: Attestation): FamilyUnit {
  let members: FamilyMember[] = [];
  const raw = leafValue(att, 'members');
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (
            typeof entry !== 'object' ||
            entry === null
          ) {
            continue;
          }
          const e = entry as Record<string, unknown>;
          const pubkey = typeof e.pubkey === 'string' ? e.pubkey : '';
          const name = typeof e.name === 'string' ? e.name : '';
          const role = e.role;
          const as_of = typeof e.as_of === 'string' ? e.as_of : '';
          if (!HEX_64.test(pubkey)) continue;
          if (!isFamilyRole(role)) continue;
          members.push({
            pubkey: pubkey.toLowerCase(),
            name,
            role,
            as_of: as_of || undefined,
          });
        }
      }
    } catch {
      members = [];
    }
  }
  return {
    familyName: leafValue(att, 'family_name'),
    members,
    foundedAt: leafValue(att, 'founded_at'),
    founderId: leafValue(att, 'founder_id'),
    founderName: leafValue(att, 'founder_name'),
  };
}

/**
 * Count how many of the named members have signed the envelope.
 *
 * `keyAliases` lets the caller bridge a member's identity pubkey to
 * a key-history. A rotated wallet signs with its active key, which
 * differs from its genesis identity pubkey; without an alias map a
 * post-rotation signature would be missed and the founder would
 * appear unsigned. Callers that know the operator's own keyHistory
 * (FamilyIdentitySections via useWallet) pass it in keyed on
 * wallet.identity. For other members the caller does not know the
 * remote wallet's key-history, so omitting them just means the
 * direct-pubkey match still applies — pre-rotation signatures
 * continue to count, post-rotation signatures from remote peers
 * don't (a separate problem for a later cut).
 */
export function familySignatureProgress(
  att: Attestation,
  keyAliases?: ReadonlyMap<string, readonly string[]>,
): {
  signed: number;
  total: number;
} {
  const view = readFamilyUnit(att);
  const signers = new Set(
    att.signatures.map((s) => s.signer.toLowerCase()),
  );
  let signed = 0;
  for (const m of view.members) {
    if (memberHasSigned(m.pubkey, signers, keyAliases)) signed += 1;
  }
  return { signed, total: view.members.length };
}

/**
 * Predicate form of the keyAliases-aware sign check: true when this
 * member's pubkey OR any aliased key for it appears in the signer set.
 * Exported so UI callers can render per-member labels using the same
 * bridge logic the aggregate counter uses.
 */
export function memberHasSigned(
  memberPubkey: string,
  signers: ReadonlySet<string>,
  keyAliases?: ReadonlyMap<string, readonly string[]>,
): boolean {
  const lower = memberPubkey.toLowerCase();
  if (signers.has(lower)) return true;
  const aliases = keyAliases?.get(lower);
  if (!aliases) return false;
  for (const a of aliases) {
    if (signers.has(a.toLowerCase())) return true;
  }
  return false;
}

/** True when the given pubkey is the founder of this family unit. */
export function isFamilyFounder(att: Attestation, pubkey: string): boolean {
  return (
    leafValue(att, 'founder_id').toLowerCase() === pubkey.toLowerCase()
  );
}

/**
 * Count how many NON-founder members have ratified (signed). Used to
 * gate the founder-side Edit affordance: editing a family rebuilds and
 * re-signs the envelope, which mints a fresh envelopeId and therefore
 * orphans any signatures already collected. That is harmless while the
 * founder is the only signer, but once another member has ratified
 * their consent, silently dropping it on an edit would be dishonest —
 * so the UI only offers Edit when this returns 0 and steers the
 * operator to Delete-and-recreate (or, later, a proper amendment
 * envelope) otherwise. keyAliases bridges the founder's own rotation
 * chain the same way the progress counter does.
 */
export function familyOtherRatifierCount(
  att: Attestation,
  keyAliases?: ReadonlyMap<string, readonly string[]>,
): number {
  const view = readFamilyUnit(att);
  const founder = view.founderId.toLowerCase();
  const signers = new Set(att.signatures.map((s) => s.signer.toLowerCase()));
  let n = 0;
  for (const m of view.members) {
    if (m.pubkey.toLowerCase() === founder) continue;
    if (memberHasSigned(m.pubkey, signers, keyAliases)) n += 1;
  }
  return n;
}

/** True when every named member's pubkey has signed the envelope. */
export function familySignersComplete(
  att: Attestation,
  keyAliases?: ReadonlyMap<string, readonly string[]>,
): boolean {
  const { signed, total } = familySignatureProgress(att, keyAliases);
  return total > 0 && signed === total;
}

/**
 * Find every family-unit credential in holdings that names the given
 * pubkey as a member. A person can belong to more than one family
 * (e.g. their birth family AND a chosen family); both surface here.
 * Case-insensitive on the pubkey comparison.
 */
export function findFamilyUnitsForMember(
  holdings: readonly Attestation[],
  memberPubkey: string,
): Attestation[] {
  const lowered = memberPubkey.toLowerCase();
  return holdings.filter((att) => {
    if (!isFamilyUnit(att)) return false;
    const view = readFamilyUnit(att);
    return view.members.some((m) => m.pubkey.toLowerCase() === lowered);
  });
}
