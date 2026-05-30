import { describe, it, expect } from 'vitest';
import {
  Wallet,
  credentialAttestation,
  identityAttestation,
} from 'tapit-attest';
import type { Attestation } from 'tapit-attest';
import { buildFamilyUnitDraft, type FamilyMember } from './familyUnit.ts';
import { buildHandshakeDraft } from './createHandshake.ts';
import { findVouchingCircleCandidates } from './findVouchingCircleCandidates.ts';

function newWalletAs(name: string): { wallet: Wallet; identity: Attestation } {
  const wallet = Wallet.generate();
  const identity = wallet.sign(
    identityAttestation({
      subject: wallet.publicKey,
      tier: 'notable',
      fields: { display_name: name },
    }),
  );
  return { wallet, identity };
}

function familyMember(
  party: { identity: Attestation },
  role: FamilyMember['role'],
): FamilyMember {
  return { pubkey: party.identity.subject, name: role, role };
}

function cohortCredential(
  founder: { wallet: Wallet; identity: Attestation },
  members: { pubkey: string; name: string }[],
): Attestation {
  return founder.wallet.sign(
    credentialAttestation({
      subject: founder.identity.subject,
      tier: 'notable',
      fields: {
        credential_type: 'recovery-cohort',
        members,
        threshold: '2',
        total_shares: String(members.length),
        declared_at: '2026-05-29T12:00:00Z',
      },
    }),
  );
}

describe('findVouchingCircleCandidates', () => {
  it('returns empty when holdings are empty', () => {
    const me = newWalletAs('Me');
    const result = findVouchingCircleCandidates([], me.identity.subject);
    expect(result).toEqual([]);
  });

  it('extracts a family-unit member as a candidate with source=family', () => {
    const me = newWalletAs('Me');
    const cousin = newWalletAs('Cousin');
    const family = me.wallet.sign(
      buildFamilyUnitDraft(me.identity, 'The Family', [
        familyMember(me, 'dad'),
        familyMember(cousin, 'child'),
      ]),
    );
    const result = findVouchingCircleCandidates([family], me.identity.subject);
    expect(result).toHaveLength(1);
    expect(result[0]?.pubkey).toBe(cousin.identity.subject.toLowerCase());
    expect(result[0]?.sources).toEqual(['family']);
  });

  it('extracts a cohort member as a candidate with source=cohort', () => {
    const me = newWalletAs('Me');
    const cohort = cohortCredential(me, [
      { pubkey: '11'.repeat(32), name: 'Alice' },
      { pubkey: '22'.repeat(32), name: 'Bob' },
    ]);
    const result = findVouchingCircleCandidates([cohort], me.identity.subject);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name).sort()).toEqual(['Alice', 'Bob']);
    expect(result.every((r) => r.sources.includes('cohort'))).toBe(true);
  });

  it('extracts a handshake peer as a candidate with source=handshake', () => {
    const me = newWalletAs('Me');
    const friend = newWalletAs('Friend');
    const handshake = me.wallet.sign(
      buildHandshakeDraft(me.identity, friend.identity, 'friend'),
    );
    const result = findVouchingCircleCandidates(
      [handshake],
      me.identity.subject,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.pubkey).toBe(friend.identity.subject.toLowerCase());
    expect(result[0]?.sources).toEqual(['handshake']);
  });

  it('deduplicates a peer who appears in multiple sources', () => {
    const me = newWalletAs('Me');
    const sister = newWalletAs('Sister');
    const family = me.wallet.sign(
      buildFamilyUnitDraft(me.identity, 'The Family', [
        familyMember(me, 'dad'),
        familyMember(sister, 'child'),
      ]),
    );
    const handshake = me.wallet.sign(
      buildHandshakeDraft(me.identity, sister.identity, 'family'),
    );
    const cohort = cohortCredential(me, [
      { pubkey: sister.identity.subject, name: 'Sister' },
    ]);
    const result = findVouchingCircleCandidates(
      [family, handshake, cohort],
      me.identity.subject,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.pubkey).toBe(sister.identity.subject.toLowerCase());
    expect(new Set(result[0]?.sources)).toEqual(
      new Set(['family', 'cohort', 'handshake']),
    );
  });

  it('excludes the operator own pubkey from candidates', () => {
    const me = newWalletAs('Me');
    const family = me.wallet.sign(
      buildFamilyUnitDraft(me.identity, 'Solo Family', [
        familyMember(me, 'dad'),
      ]),
    );
    const result = findVouchingCircleCandidates([family], me.identity.subject);
    expect(result).toHaveLength(0);
  });

  it('prefers the family-source name when a peer appears in multiple sources', () => {
    const me = newWalletAs('Me');
    const peer = newWalletAs('Peer');
    // Family lists them as "mom" (role-as-name in test fixtures)
    const family = me.wallet.sign(
      buildFamilyUnitDraft(me.identity, 'Fam', [
        familyMember(me, 'dad'),
        familyMember(peer, 'mom'),
      ]),
    );
    // Handshake names them as "Peer"
    const handshake = me.wallet.sign(
      buildHandshakeDraft(me.identity, peer.identity, 'family'),
    );
    const result = findVouchingCircleCandidates(
      [family, handshake],
      me.identity.subject,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('mom');
  });

  it('returns sorted output (alphabetic by name, stable on pubkey tiebreak)', () => {
    const me = newWalletAs('Me');
    const cohort = cohortCredential(me, [
      { pubkey: '11'.repeat(32), name: 'Charlie' },
      { pubkey: '22'.repeat(32), name: 'Alice' },
      { pubkey: '33'.repeat(32), name: 'Bob' },
    ]);
    const result = findVouchingCircleCandidates([cohort], me.identity.subject);
    expect(result.map((r) => r.name)).toEqual(['Alice', 'Bob', 'Charlie']);
  });
});
