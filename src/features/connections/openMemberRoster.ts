import type { Attestation, Wallet } from 'tapit-attest';
import { credentialAttestation, envelopeId } from 'tapit-attest';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';
import { leafValue } from './createHandshake.ts';
import { isSelfMembership, readSelfMembership } from './createMembership.ts';

// Phase 8 Phase E3 cut 2 — open-member roster. The org-side counterpart
// to the joiner-side self-membership shipped in Phase E2 + gated by
// Phase E3 cut 1. Under the hybrid substrate (Option 3 from the open-
// joining brief) the org publishes a periodic roster snapshot listing
// every accepted self-membership in chronological join order; a
// verifier in Phase E4 can read this roster as a single auditable
// artifact and confirm a claimed member is on it. The roster envelope
// is itself anchored to Bitcoin via the existing OpenTimestamps worker
// the same way officials-rosters are, so each publish is one anchor
// event and the roster's own anchor height is provable.
//
// Same envelope-shape pattern as the officials-roster:
//   - credential-kind attestation
//   - subject = the org's pubkey
//   - credential_type leaf = 'open_member_roster'
//   - org_id leaf = the org's pubkey (== subject; named explicitly so
//     readers do not have to special-case the subject->orgId mapping)
//   - members leaf = canonical JSON of an array of
//     {member_id, joined_at, self_membership_envelope_id} entries,
//     sorted ascending by joined_at then by member_id for tiebreaks
//   - issued_at leaf = ISO timestamp at publish time; latest-by-
//     issuedAt wins for current-state reads, every snapshot ever
//     published is held and anchored so governance history is auditable
//
// "Pending" semantics: an accepted self-membership in the org's
// holdings whose envelopeId is NOT yet listed in the latest published
// roster. pendingSelfMemberships returns the delta; acceptedSelf-
// Memberships returns the full set (what the next roster would carry
// if published right now). UI in Phase E4 wires both — the operator
// sees the delta to decide whether a publish is worth doing, and the
// publish path snapshots the full set.

export interface OpenMemberRosterEntry {
  /** Joiner's pubkey (the self-membership envelope's subject). */
  member_id: string;
  /** ISO timestamp from the self-membership envelope's joined_at leaf. */
  joined_at: string;
  /** envelopeId of the joiner's self-membership envelope — lets a
   *  verifier cross-reference the roster against the actual signed
   *  self-claim when the verifier holds both. */
  self_membership_envelope_id: string;
}

/** True when an attestation is an open-member roster credential. */
export function isOpenMemberRoster(att: Attestation): boolean {
  return (
    att.kind === 'credential' &&
    leafValue(att, 'credential_type') === 'open_member_roster'
  );
}

/** All self-memberships in holdings whose org_id leaf matches the
 *  named org, sorted ascending by joined_at (then by member_id for
 *  stable ordering when two joins share a timestamp). This is what
 *  buildOpenMemberRosterDraft snapshots when the org publishes —
 *  every accepted self-membership at this moment in time. */
export function acceptedSelfMemberships(
  orgId: string,
  holdings: readonly Attestation[],
): Attestation[] {
  const matches: Attestation[] = [];
  for (const a of holdings) {
    if (!isSelfMembership(a)) continue;
    if (leafValue(a, 'org_id') !== orgId) continue;
    matches.push(a);
  }
  matches.sort((a, b) => {
    const av = readSelfMembership(a);
    const bv = readSelfMembership(b);
    if (av.joinedAt !== bv.joinedAt) return av.joinedAt.localeCompare(bv.joinedAt);
    return av.joinerId.localeCompare(bv.joinerId);
  });
  return matches;
}

/** Subset of acceptedSelfMemberships whose envelopeId is NOT named
 *  by the latest published roster for the org. Surfaces the "delta"
 *  the operator would be publishing if they hit the publish button
 *  right now — useful for UI that wants to show "3 new joins since
 *  your last roster snapshot." Empty when every accepted member is
 *  already on the latest roster (or when no roster has ever been
 *  published — in which case every accepted member is pending). */
export function pendingSelfMemberships(
  orgId: string,
  holdings: readonly Attestation[],
): Attestation[] {
  const all = acceptedSelfMemberships(orgId, holdings);
  const latest = findLatestOpenMemberRoster(holdings, orgId);
  if (!latest) return all;
  const published = new Set(
    readOpenMemberRoster(latest).map((e) => e.self_membership_envelope_id),
  );
  return all.filter((a) => !published.has(envelopeId(a)));
}

/** Build (but do not sign) the unsigned open-member roster envelope
 *  for an org. Members are derived from the supplied self-membership
 *  envelopes; the caller usually passes acceptedSelfMemberships
 *  output, but tests and special-case publishers can hand in any list.
 *  publishedAt defaults to now; supplying it explicitly lets tests
 *  assert envelope-shape deterministically. Pure function — no I/O,
 *  no signing, no holding, no anchoring. */
export function buildOpenMemberRosterDraft(
  orgIdentity: string,
  selfMemberships: readonly Attestation[],
  publishedAt?: string,
): Attestation {
  const entries: OpenMemberRosterEntry[] = selfMemberships.map((a) => {
    const view = readSelfMembership(a);
    return {
      member_id: view.joinerId,
      joined_at: view.joinedAt,
      self_membership_envelope_id: envelopeId(a),
    };
  });
  entries.sort((a, b) => {
    if (a.joined_at !== b.joined_at) return a.joined_at.localeCompare(b.joined_at);
    return a.member_id.localeCompare(b.member_id);
  });
  return credentialAttestation({
    subject: orgIdentity,
    tier: 'notable',
    fields: {
      credential_type: 'open_member_roster',
      org_id: orgIdentity,
      members: entries,
      issued_at: publishedAt ?? new Date().toISOString(),
    },
  });
}

/** Build, sign, hold, and anchor a new open-member roster envelope
 *  for the org. Always snapshots the FULL accepted-self-memberships
 *  set (not just the pending delta) — the roster is a complete
 *  current-state artifact, not an incremental update. Returns the
 *  signed envelope. Same hold-and-anchor pipeline as
 *  publishOfficialsRoster: write to wallet.hold, upsert into the
 *  anchor queue, kick the worker. */
export async function publishOpenMemberRoster(
  wallet: Wallet,
  ownerId: string,
  anchorWorker: WorkerHandle | null,
  holdings: readonly Attestation[],
): Promise<Attestation> {
  const accepted = acceptedSelfMemberships(wallet.identity, holdings);
  const draft = buildOpenMemberRosterDraft(wallet.identity, accepted);
  const signed = wallet.sign(draft);
  await wallet.hold(signed);
  const digestHex = envelopeId(signed);
  await anchorQueue.upsert(ownerId, {
    digestHex,
    state: 'queued',
    anchor: null,
    attempts: 0,
    last_attempt: null,
    last_error: null,
  });
  if (anchorWorker) void anchorWorker.kick();
  return signed;
}

/** Latest-by-issued_at open-member roster the org has published.
 *  Same selection semantics as findLatestOfficialsRoster: subject
 *  must equal the org pubkey, the org must have signed the envelope,
 *  newest issued_at wins. Null when no roster has ever been
 *  published — Phase E4 verifier falls back to the auth-tree walk
 *  (Option 2 path) in that case under the hybrid substrate. */
export function findLatestOpenMemberRoster(
  holdings: readonly Attestation[],
  orgIdentity: string,
): Attestation | null {
  let latest: Attestation | null = null;
  let latestMs = -Infinity;
  for (const a of holdings) {
    if (!isOpenMemberRoster(a)) continue;
    if (a.subject !== orgIdentity) continue;
    if (!a.signatures.some((s) => s.signer === orgIdentity)) continue;
    const ms = new Date(a.issuedAt).getTime();
    if (!Number.isFinite(ms)) continue;
    if (ms > latestMs) {
      latestMs = ms;
      latest = a;
    }
  }
  return latest;
}

/** Parse the members list out of a roster attestation. Malformed
 *  leaf returns an empty list — same shape-tolerant pattern
 *  readOfficials uses so a UI render path never throws on a wonky
 *  envelope. Entries that miss required fields are dropped
 *  individually; the rest of the roster comes back unaffected. */
export function readOpenMemberRoster(att: Attestation): OpenMemberRosterEntry[] {
  const raw = leafValue(att, 'members');
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: OpenMemberRosterEntry[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.member_id !== 'string') continue;
    if (typeof e.joined_at !== 'string') continue;
    if (typeof e.self_membership_envelope_id !== 'string') continue;
    out.push({
      member_id: e.member_id,
      joined_at: e.joined_at,
      self_membership_envelope_id: e.self_membership_envelope_id,
    });
  }
  return out;
}
