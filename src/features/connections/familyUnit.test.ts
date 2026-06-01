import { describe, it, expect } from 'vitest';
import {
  Wallet,
  identityAttestation,
  credentialAttestation,
} from 'tapit-attest';
import type { Attestation } from 'tapit-attest';
import {
  buildFamilyUnitDraft,
  buildFamilyWithAddedMember,
  familyOtherRatifierCount,
  familySignatureProgress,
  familySignersComplete,
  findFamilyUnitsForMember,
  isFamilyFounder,
  isFamilyUnit,
  memberHasSigned,
  readFamilyUnit,
  type FamilyMember,
} from './familyUnit.ts';

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

function memberOf(
  party: { wallet: Wallet; identity: Attestation },
  role: FamilyMember['role'],
  asOf?: string,
): FamilyMember {
  const name = party.identity.claim;
  void name; // hush typecheck; name is read from identity attestation
  return {
    pubkey: party.identity.subject,
    name: role,
    role,
    ...(asOf ? { as_of: asOf } : {}),
  };
}

describe('isFamilyUnit', () => {
  it('returns true for a credential with credential_type = family_unit', () => {
    const dad = newWalletAs('Dad');
    const draft = buildFamilyUnitDraft(dad.identity, 'Test', [
      memberOf(dad, 'dad'),
    ]);
    expect(isFamilyUnit(draft)).toBe(true);
  });

  it('returns false for membership credentials and other types', () => {
    const dad = newWalletAs('Dad');
    const notFam = credentialAttestation({
      subject: dad.identity.subject,
      tier: 'notable',
      fields: { credential_type: 'membership' },
    });
    expect(isFamilyUnit(notFam)).toBe(false);
  });
});

describe('isFamilyFounder', () => {
  it('is true for the founder pubkey and false for other members', () => {
    const dad = newWalletAs('Dad');
    const kid = newWalletAs('Kid');
    const draft = buildFamilyUnitDraft(dad.identity, 'Test', [
      memberOf(dad, 'dad'),
      memberOf(kid, 'child'),
    ]);
    expect(isFamilyFounder(draft, dad.identity.subject)).toBe(true);
    expect(isFamilyFounder(draft, kid.identity.subject)).toBe(false);
  });

  it('is case-insensitive on the pubkey', () => {
    const dad = newWalletAs('Dad');
    const draft = buildFamilyUnitDraft(dad.identity, 'Test', [
      memberOf(dad, 'dad'),
    ]);
    expect(isFamilyFounder(draft, dad.identity.subject.toUpperCase())).toBe(
      true,
    );
  });
});

describe('familyOtherRatifierCount', () => {
  it('is 0 when only the founder has signed (Edit is unlocked)', () => {
    const dad = newWalletAs('Dad');
    const kid = newWalletAs('Kid');
    const draft = buildFamilyUnitDraft(dad.identity, 'Test', [
      memberOf(dad, 'dad'),
      memberOf(kid, 'child'),
    ]);
    const founderSigned = dad.wallet.sign(draft);
    expect(familyOtherRatifierCount(founderSigned)).toBe(0);
  });

  it('counts non-founder ratifiers and excludes the founder', () => {
    const dad = newWalletAs('Dad');
    const kid = newWalletAs('Kid');
    const draft = buildFamilyUnitDraft(dad.identity, 'Test', [
      memberOf(dad, 'dad'),
      memberOf(kid, 'child'),
    ]);
    const founderSigned = dad.wallet.sign(draft);
    const bothSigned = kid.wallet.sign(founderSigned);
    expect(familyOtherRatifierCount(bothSigned)).toBe(1);
  });
});

describe('buildFamilyUnitDraft validation', () => {
  it('throws when the member list is empty', () => {
    const dad = newWalletAs('Dad');
    expect(() => buildFamilyUnitDraft(dad.identity, 'X', [])).toThrow(
      /at least one member/,
    );
  });

  it('throws when the founder is not in the member list', () => {
    const dad = newWalletAs('Dad');
    const someone = newWalletAs('Someone');
    expect(() =>
      buildFamilyUnitDraft(dad.identity, 'X', [memberOf(someone, 'parent')]),
    ).toThrow(/founder must be listed/);
  });

  it('throws on duplicate member pubkeys', () => {
    const dad = newWalletAs('Dad');
    expect(() =>
      buildFamilyUnitDraft(dad.identity, 'X', [
        memberOf(dad, 'dad'),
        memberOf(dad, 'parent'),
      ]),
    ).toThrow(/duplicate member pubkey/);
  });

  it('throws on invalid roles', () => {
    const dad = newWalletAs('Dad');
    const member: FamilyMember = {
      pubkey: dad.identity.subject,
      name: 'Dad',
      // @ts-expect-error — testing rejection of invalid role at runtime
      role: 'uncle',
    };
    expect(() => buildFamilyUnitDraft(dad.identity, 'X', [member])).toThrow(
      /invalid family role/,
    );
  });

  it('throws when a member pubkey is not 64-char hex', () => {
    const dad = newWalletAs('Dad');
    const bad: FamilyMember = {
      pubkey: 'not-hex',
      name: 'Kid',
      role: 'child',
    };
    expect(() =>
      buildFamilyUnitDraft(dad.identity, 'X', [memberOf(dad, 'dad'), bad]),
    ).toThrow(/not 64-char hex/);
  });
});

describe('readFamilyUnit', () => {
  it('round-trips members through the canonical JSON leaf', () => {
    const dad = newWalletAs('Dad');
    const mom = newWalletAs('Mom');
    const kid = newWalletAs('Kid');
    const draft = buildFamilyUnitDraft(dad.identity, 'Family', [
      memberOf(dad, 'dad'),
      memberOf(mom, 'mom'),
      memberOf(kid, 'child', '2020-01-15'),
    ]);
    const view = readFamilyUnit(draft);
    expect(view.members).toHaveLength(3);
    expect(view.members[2]?.as_of).toBe('2020-01-15');
    expect(view.familyName).toBe('Family');
    expect(view.founderId).toBe(dad.identity.subject);
  });

  it('drops malformed entries individually rather than blanking the list', () => {
    const dad = newWalletAs('Dad');
    // Hand-craft a credential with one valid and one malformed entry
    const bad = credentialAttestation({
      subject: dad.identity.subject,
      tier: 'notable',
      fields: {
        credential_type: 'family_unit',
        family_name: 'Mixed',
        members: JSON.stringify([
          {
            pubkey: dad.identity.subject.toLowerCase(),
            name: 'Dad',
            role: 'dad',
          },
          { pubkey: 'not-hex', name: 'X', role: 'parent' },
          { pubkey: '0'.repeat(64), name: 'NoRole', role: 'uncle' },
        ]),
        founded_at: new Date().toISOString(),
        founder_id: dad.identity.subject,
        founder_name: 'Dad',
      },
    });
    const view = readFamilyUnit(bad);
    expect(view.members).toHaveLength(1);
    expect(view.members[0]?.role).toBe('dad');
  });

  it('returns an empty member list when the members leaf is missing', () => {
    const dad = newWalletAs('Dad');
    const noMembers = credentialAttestation({
      subject: dad.identity.subject,
      tier: 'notable',
      fields: {
        credential_type: 'family_unit',
        family_name: 'Empty',
        founded_at: new Date().toISOString(),
        founder_id: dad.identity.subject,
        founder_name: 'Dad',
      },
    });
    expect(readFamilyUnit(noMembers).members).toEqual([]);
  });

  it('returns an empty member list when the members leaf is non-JSON', () => {
    const dad = newWalletAs('Dad');
    const bad = credentialAttestation({
      subject: dad.identity.subject,
      tier: 'notable',
      fields: {
        credential_type: 'family_unit',
        family_name: 'Bad',
        members: '{not json',
        founded_at: new Date().toISOString(),
        founder_id: dad.identity.subject,
        founder_name: 'Dad',
      },
    });
    expect(readFamilyUnit(bad).members).toEqual([]);
  });
});

describe('familySignatureProgress + familySignersComplete', () => {
  it('reports 1/3 when only the founder has signed', () => {
    const dad = newWalletAs('Dad');
    const mom = newWalletAs('Mom');
    const kid = newWalletAs('Kid');
    const draft = buildFamilyUnitDraft(dad.identity, 'F', [
      memberOf(dad, 'dad'),
      memberOf(mom, 'mom'),
      memberOf(kid, 'child'),
    ]);
    const signed1 = dad.wallet.sign(draft);
    const prog = familySignatureProgress(signed1);
    expect(prog).toEqual({ signed: 1, total: 3 });
    expect(familySignersComplete(signed1)).toBe(false);
  });

  it('reports 3/3 and complete=true when every member has signed', () => {
    const dad = newWalletAs('Dad');
    const mom = newWalletAs('Mom');
    const kid = newWalletAs('Kid');
    const draft = buildFamilyUnitDraft(dad.identity, 'F', [
      memberOf(dad, 'dad'),
      memberOf(mom, 'mom'),
      memberOf(kid, 'child'),
    ]);
    const full = kid.wallet.sign(mom.wallet.sign(dad.wallet.sign(draft)));
    const prog = familySignatureProgress(full);
    expect(prog).toEqual({ signed: 3, total: 3 });
    expect(familySignersComplete(full)).toBe(true);
  });

  it('ignores signatures from non-members', () => {
    const dad = newWalletAs('Dad');
    const outsider = newWalletAs('Outsider');
    const draft = buildFamilyUnitDraft(dad.identity, 'F', [memberOf(dad, 'dad')]);
    const withOutsider = outsider.wallet.sign(dad.wallet.sign(draft));
    expect(familySignatureProgress(withOutsider)).toEqual({
      signed: 1,
      total: 1,
    });
  });

  it('misses a rotated-key signature without keyAliases (founder appears unsigned)', () => {
    const dad = newWalletAs('Dad');
    const draft = buildFamilyUnitDraft(dad.identity, 'F', [memberOf(dad, 'dad')]);
    dad.wallet.rotate();
    const signed = dad.wallet.sign(draft);
    // Founder member.pubkey == genesis identity; signer == rotated active
    // key. Without an alias bridge the counter sees zero matches.
    expect(familySignatureProgress(signed)).toEqual({ signed: 0, total: 1 });
  });

  it('detects a rotated-key signature when keyAliases bridges identity to keyHistory', () => {
    const dad = newWalletAs('Dad');
    const draft = buildFamilyUnitDraft(dad.identity, 'F', [memberOf(dad, 'dad')]);
    dad.wallet.rotate();
    const signed = dad.wallet.sign(draft);
    const aliases = new Map<string, readonly string[]>([
      [dad.identity.subject.toLowerCase(), dad.wallet.keyHistory],
    ]);
    expect(familySignatureProgress(signed, aliases)).toEqual({
      signed: 1,
      total: 1,
    });
    expect(familySignersComplete(signed, aliases)).toBe(true);
  });
});

describe('memberHasSigned', () => {
  it('returns true on a direct pubkey match without aliases', () => {
    const a = newWalletAs('A');
    const draft = buildFamilyUnitDraft(a.identity, 'F', [memberOf(a, 'parent')]);
    const signed = a.wallet.sign(draft);
    const signers = new Set(signed.signatures.map((s) => s.signer.toLowerCase()));
    expect(memberHasSigned(a.identity.subject, signers)).toBe(true);
  });

  it('returns false when the member did not sign and no aliases supplied', () => {
    const a = newWalletAs('A');
    const b = newWalletAs('B');
    const draft = buildFamilyUnitDraft(a.identity, 'F', [
      memberOf(a, 'parent'),
      memberOf(b, 'child'),
    ]);
    const signed = a.wallet.sign(draft); // only A signed
    const signers = new Set(signed.signatures.map((s) => s.signer.toLowerCase()));
    expect(memberHasSigned(b.identity.subject, signers)).toBe(false);
  });

  it('counts an aliased signer as the member having signed', () => {
    const a = newWalletAs('A');
    const draft = buildFamilyUnitDraft(a.identity, 'F', [memberOf(a, 'parent')]);
    a.wallet.rotate();
    const signed = a.wallet.sign(draft);
    const signers = new Set(signed.signatures.map((s) => s.signer.toLowerCase()));
    const aliases = new Map<string, readonly string[]>([
      [a.identity.subject.toLowerCase(), a.wallet.keyHistory],
    ]);
    expect(memberHasSigned(a.identity.subject, signers, aliases)).toBe(true);
  });
});

describe('findFamilyUnitsForMember', () => {
  it('returns family units that name the given pubkey as a member', () => {
    const dad = newWalletAs('Dad');
    const kid = newWalletAs('Kid');
    const unit = buildFamilyUnitDraft(dad.identity, 'F', [
      memberOf(dad, 'dad'),
      memberOf(kid, 'child'),
    ]);
    const holdings = [dad.identity, kid.identity, unit];
    const found = findFamilyUnitsForMember(holdings, kid.identity.subject);
    expect(found).toHaveLength(1);
    expect(found[0]).toBe(unit);
  });

  it('returns multiple units when the person belongs to more than one family', () => {
    const kid = newWalletAs('Kid');
    const parent1 = newWalletAs('P1');
    const parent2 = newWalletAs('P2');
    const birth = buildFamilyUnitDraft(parent1.identity, 'Birth', [
      memberOf(parent1, 'parent'),
      memberOf(kid, 'child'),
    ]);
    const chosen = buildFamilyUnitDraft(parent2.identity, 'Chosen', [
      memberOf(parent2, 'parent'),
      memberOf(kid, 'child'),
    ]);
    const found = findFamilyUnitsForMember(
      [birth, chosen],
      kid.identity.subject,
    );
    expect(found).toHaveLength(2);
  });

  it('is case-insensitive on the pubkey comparison', () => {
    const dad = newWalletAs('Dad');
    const unit = buildFamilyUnitDraft(dad.identity, 'F', [memberOf(dad, 'dad')]);
    const found = findFamilyUnitsForMember(
      [unit],
      dad.identity.subject.toUpperCase(),
    );
    expect(found).toHaveLength(1);
  });

  it('returns an empty array when the pubkey is in no family', () => {
    const dad = newWalletAs('Dad');
    const stranger = newWalletAs('Stranger');
    const unit = buildFamilyUnitDraft(dad.identity, 'F', [memberOf(dad, 'dad')]);
    expect(
      findFamilyUnitsForMember([unit], stranger.identity.subject),
    ).toEqual([]);
  });
});
