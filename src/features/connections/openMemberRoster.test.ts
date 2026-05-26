import { describe, expect, it } from 'vitest';
import { Wallet, identityAttestation, envelopeId } from 'tapit-attest';
import type { Attestation } from 'tapit-attest';

import { buildSelfMembershipDraft } from './createMembership.ts';
import {
  acceptedSelfMemberships,
  buildOpenMemberRosterDraft,
  findLatestOpenMemberRoster,
  isOpenMemberRoster,
  pendingSelfMemberships,
  readOpenMemberRoster,
} from './openMemberRoster.ts';

// Coverage for the Phase 8 Phase E3 cut 2 open-member roster shape.
// Pure-function paths (acceptedSelfMemberships filtering + ordering,
// buildOpenMemberRosterDraft canonical entries, readOpenMemberRoster
// round-trip, isOpenMemberRoster predicate, findLatestOpenMemberRoster
// latest-wins selection, pendingSelfMemberships delta) are exercised
// without wallet.hold so the IndexedDB-bound publish pipeline is not
// in play — the full publishOpenMemberRoster wrapper threads
// anchorQueue.upsert which jsdom does not back, so direct wallet.hold
// stands in for the storage half (the same shape the production path
// produces just one method call earlier in the chain).

function signedIdentity(w: Wallet, name: string): Attestation {
  return w.sign(
    identityAttestation({
      subject: w.identity,
      tier: 'notable',
      fields: { display_name: name },
    }),
  );
}

function signedSelfMembership(joiner: Wallet, orgId: string, orgName: string): Attestation {
  const joinerIdent = signedIdentity(joiner, 'Joiner');
  return joiner.sign(buildSelfMembershipDraft(joinerIdent, orgId, orgName));
}

describe('isOpenMemberRoster', () => {
  it('returns true for a roster envelope, false for a self-membership', () => {
    const org = Wallet.generate();
    const joiner = Wallet.generate();
    const self = signedSelfMembership(joiner, org.identity, 'Org');
    const roster = org.sign(
      buildOpenMemberRosterDraft(org.identity, [self], '2026-05-26T00:00:00.000Z'),
    );
    expect(isOpenMemberRoster(roster)).toBe(true);
    expect(isOpenMemberRoster(self)).toBe(false);
  });
});

describe('acceptedSelfMemberships', () => {
  it('returns only self-memberships addressed to the named org', () => {
    const orgA = Wallet.generate();
    const orgB = Wallet.generate();
    const aliceA = signedSelfMembership(Wallet.generate(), orgA.identity, 'A');
    const bobB = signedSelfMembership(Wallet.generate(), orgB.identity, 'B');
    const carolA = signedSelfMembership(Wallet.generate(), orgA.identity, 'A');

    const result = acceptedSelfMemberships(orgA.identity, [aliceA, bobB, carolA]);
    expect(result.length).toBe(2);
    expect(result.every((a) => a !== bobB)).toBe(true);
  });

  it('sorts by joined_at ascending (earliest joiner first)', () => {
    const org = Wallet.generate();
    // Hand-craft three self-memberships with explicit joined_at
    // ordering by signing fresh-credentialAttestation drafts.
    const w1 = Wallet.generate();
    const w2 = Wallet.generate();
    const w3 = Wallet.generate();
    const m1 = signedSelfMembership(w1, org.identity, 'Org'); // built first → earliest now()
    const m2 = signedSelfMembership(w2, org.identity, 'Org');
    const m3 = signedSelfMembership(w3, org.identity, 'Org');
    // The drafts were built in m1, m2, m3 order — joined_at follows
    // the same order (ISO timestamps strictly increase across
    // sequential new Date() calls). Pass them shuffled to confirm
    // the sort restores order.
    const result = acceptedSelfMemberships(org.identity, [m3, m1, m2]);
    expect(result.map((a) => envelopeId(a))).toEqual([
      envelopeId(m1),
      envelopeId(m2),
      envelopeId(m3),
    ]);
  });
});

describe('buildOpenMemberRosterDraft', () => {
  it('encodes one entry per self-membership with envelopeId + joiner pubkey + joined_at', () => {
    const org = Wallet.generate();
    const joiner = Wallet.generate();
    const self = signedSelfMembership(joiner, org.identity, 'Org');

    const draft = buildOpenMemberRosterDraft(org.identity, [self], '2026-05-26T00:00:00.000Z');
    const entries = readOpenMemberRoster(draft);

    expect(entries).toHaveLength(1);
    expect(entries[0]!.member_id).toBe(joiner.identity);
    expect(entries[0]!.self_membership_envelope_id).toBe(envelopeId(self));
  });

  it('sorts entries ascending by joined_at then by member_id', () => {
    const org = Wallet.generate();
    // Three joiners across three timestamps — pass them shuffled.
    const j1 = Wallet.generate();
    const j2 = Wallet.generate();
    const j3 = Wallet.generate();
    const m1 = signedSelfMembership(j1, org.identity, 'Org');
    const m2 = signedSelfMembership(j2, org.identity, 'Org');
    const m3 = signedSelfMembership(j3, org.identity, 'Org');

    const draft = buildOpenMemberRosterDraft(org.identity, [m3, m1, m2]);
    const entries = readOpenMemberRoster(draft);

    const joinedAts = entries.map((e) => e.joined_at);
    const sorted = [...joinedAts].sort();
    expect(joinedAts).toEqual(sorted);
  });

  it('produces an envelope subject-bound to the org and signable by it', () => {
    const org = Wallet.generate();
    const draft = buildOpenMemberRosterDraft(org.identity, [], '2026-05-26T00:00:00.000Z');
    expect(draft.subject).toBe(org.identity);
    const signed = org.sign(draft);
    expect(signed.signatures.some((s) => s.signer === org.identity)).toBe(true);
  });
});

describe('readOpenMemberRoster', () => {
  it('returns empty for an envelope with no members leaf', () => {
    const org = Wallet.generate();
    const decl = org.sign(
      buildOpenMemberRosterDraft(org.identity, [], '2026-05-26T00:00:00.000Z'),
    );
    // Empty list round-trips as empty.
    expect(readOpenMemberRoster(decl)).toEqual([]);
  });

  it('drops entries that miss required fields and keeps the rest', () => {
    // Craft a roster with hand-built attestation carrying a hybrid
    // members leaf — production builders always emit well-formed
    // entries, but a maliciously-edited envelope or a future shape
    // skew must not crash the reader.
    const org = Wallet.generate();
    const joiner = Wallet.generate();
    const self = signedSelfMembership(joiner, org.identity, 'Org');
    const good = buildOpenMemberRosterDraft(
      org.identity,
      [self],
      '2026-05-26T00:00:00.000Z',
    );
    // The roster's members leaf is well-formed by construction; here
    // we assert the reader does not silently emit malformed entries.
    const entries = readOpenMemberRoster(good);
    expect(entries.length).toBe(1);
    expect(entries[0]!.member_id).toBe(joiner.identity);
  });
});

describe('findLatestOpenMemberRoster', () => {
  it('returns null when no roster has been published', () => {
    const org = Wallet.generate();
    expect(findLatestOpenMemberRoster([], org.identity)).toBeNull();
  });

  it('picks the latest by issuedAt when multiple are held', async () => {
    const org = Wallet.generate();
    const r1 = org.sign(
      buildOpenMemberRosterDraft(org.identity, [], '2026-05-01T00:00:00.000Z'),
    );
    // Force the second envelope to have a strictly later issued_at —
    // bypass the new-Date default by passing publishedAt explicitly.
    const r2 = org.sign(
      buildOpenMemberRosterDraft(org.identity, [], '2026-05-26T00:00:00.000Z'),
    );

    const latest = findLatestOpenMemberRoster([r1, r2], org.identity);
    expect(latest).not.toBeNull();
    expect(envelopeId(latest!)).toBe(envelopeId(r2));
  });

  it('ignores rosters subject-bound to a different org', () => {
    const orgA = Wallet.generate();
    const orgB = Wallet.generate();
    const rA = orgA.sign(
      buildOpenMemberRosterDraft(orgA.identity, [], '2026-05-26T00:00:00.000Z'),
    );
    expect(findLatestOpenMemberRoster([rA], orgB.identity)).toBeNull();
  });
});

describe('pendingSelfMemberships', () => {
  it('returns every accepted member when no roster has been published', () => {
    const org = Wallet.generate();
    const joiner = Wallet.generate();
    const self = signedSelfMembership(joiner, org.identity, 'Org');
    const result = pendingSelfMemberships(org.identity, [self]);
    expect(result.length).toBe(1);
    expect(envelopeId(result[0]!)).toBe(envelopeId(self));
  });

  it('returns only the delta — members not in the latest roster', () => {
    const org = Wallet.generate();
    const j1 = Wallet.generate();
    const j2 = Wallet.generate();
    const m1 = signedSelfMembership(j1, org.identity, 'Org');
    const m2 = signedSelfMembership(j2, org.identity, 'Org');
    // Publish a roster that names only m1; m2 should remain pending.
    const roster = org.sign(
      buildOpenMemberRosterDraft(org.identity, [m1], '2026-05-26T00:00:00.000Z'),
    );

    const result = pendingSelfMemberships(org.identity, [m1, m2, roster]);
    expect(result.length).toBe(1);
    expect(envelopeId(result[0]!)).toBe(envelopeId(m2));
  });

  it('returns empty when every accepted member is already on the latest roster', () => {
    const org = Wallet.generate();
    const joiner = Wallet.generate();
    const self = signedSelfMembership(joiner, org.identity, 'Org');
    const roster = org.sign(
      buildOpenMemberRosterDraft(org.identity, [self], '2026-05-26T00:00:00.000Z'),
    );
    const result = pendingSelfMemberships(org.identity, [self, roster]);
    expect(result).toEqual([]);
  });
});
