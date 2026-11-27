import { describe, it, expect } from 'vitest';
import { Wallet, envelopeId, identityAttestation } from 'tapit-attest';
import type { Attestation } from 'tapit-attest';
import { buildFamilyUnitDraft, readFamilyUnit, type FamilyMember } from './familyUnit.ts';
import {
  amendmentProgress,
  buildFamilyAmendment,
  familyVersionInfo,
  resolveFamilyLines,
} from './familyAmendment.ts';
import { familyFanOutTargets } from './familyFanOut.ts';

interface Party {
  wallet: Wallet;
  identity: Attestation;
}

function party(name: string): Party {
  const wallet = Wallet.generate();
  const identity = wallet.sign(
    identityAttestation({ subject: wallet.publicKey, tier: 'notable', fields: { display_name: name } }),
  );
  return { wallet, identity };
}

function member(p: Party, role: FamilyMember['role']): FamilyMember {
  return { pubkey: p.identity.subject, name: role, role };
}

function signAll(att: Attestation, ...signers: Party[]): Attestation {
  return signers.reduce((a, p) => p.wallet.sign(a), att);
}

/** Dad founds a five-person family and all five ratify version 1. */
function ratifiedFamily() {
  const dad = party('Dad');
  const mom = party('Mom');
  const k1 = party('K1');
  const k2 = party('K2');
  const k3 = party('K3');
  const v1 = signAll(
    buildFamilyUnitDraft(dad.identity, 'The Family', [
      member(dad, 'dad'),
      member(mom, 'mom'),
      member(k1, 'child'),
      member(k2, 'child'),
      member(k3, 'child'),
    ]),
    dad,
    mom,
    k1,
    k2,
    k3,
  );
  return { dad, mom, k1, k2, k3, v1 };
}

describe('familyVersionInfo', () => {
  it('reads an original family as version 1 of its own line', () => {
    const { v1 } = ratifiedFamily();
    const info = familyVersionInfo(v1);
    expect(info).toEqual({ line: envelopeId(v1), version: 1, supersedes: null, admits: [] });
  });
});

describe('buildFamilyAmendment', () => {
  it('appends the grandchild, points back at the version it replaces, and keeps the founding date', () => {
    const { dad, v1 } = ratifiedFamily();
    const gc = party('Grandchild');
    const v2 = buildFamilyAmendment(dad.identity, v1, [member(gc, 'grandchild')]);
    const info = familyVersionInfo(v2);
    expect(info.line).toBe(envelopeId(v1));
    expect(info.supersedes).toBe(envelopeId(v1));
    expect(info.version).toBe(2);
    expect(info.admits).toEqual([gc.identity.subject.toLowerCase()]);
    expect(readFamilyUnit(v2).members).toHaveLength(6);
    expect(readFamilyUnit(v2).foundedAt).toBe(readFamilyUnit(v1).foundedAt);
    expect(envelopeId(v2)).not.toBe(envelopeId(v1));
  });

  it('refuses anyone but the founder', () => {
    const { mom, v1 } = ratifiedFamily();
    const gc = party('Grandchild');
    expect(() => buildFamilyAmendment(mom.identity, v1, [member(gc, 'grandchild')])).toThrow(/only the founder/);
  });

  it('refuses someone already in the family', () => {
    const { dad, k1, v1 } = ratifiedFamily();
    expect(() => buildFamilyAmendment(dad.identity, v1, [member(k1, 'child')])).toThrow(/duplicate/);
  });
});

describe('amendmentProgress -- majority of the family plus the newcomer', () => {
  it('is not in effect with the founder alone', () => {
    const { dad, v1 } = ratifiedFamily();
    const gc = party('Grandchild');
    const v2 = signAll(buildFamilyAmendment(dad.identity, v1, [member(gc, 'grandchild')]), dad);
    const p = amendmentProgress(v2);
    expect(p).toMatchObject({ priorTotal: 5, priorSigned: 1, priorNeeded: 3, admitsSigned: 0, inEffect: false });
  });

  it('is not in effect with a majority but without the newcomer', () => {
    const { dad, mom, k1, v1 } = ratifiedFamily();
    const gc = party('Grandchild');
    const v2 = signAll(buildFamilyAmendment(dad.identity, v1, [member(gc, 'grandchild')]), dad, mom, k1);
    expect(amendmentProgress(v2).inEffect).toBe(false);
    expect(amendmentProgress(v2).admitsAwaiting).toEqual([gc.identity.subject.toLowerCase()]);
  });

  it('is not in effect at exactly half', () => {
    const dad = party('Dad');
    const mom = party('Mom');
    const k1 = party('K1');
    const k2 = party('K2');
    const v1 = signAll(
      buildFamilyUnitDraft(dad.identity, 'Four', [member(dad, 'dad'), member(mom, 'mom'), member(k1, 'child'), member(k2, 'child')]),
      dad,
      mom,
      k1,
      k2,
    );
    const gc = party('Grandchild');
    const v2 = signAll(buildFamilyAmendment(dad.identity, v1, [member(gc, 'grandchild')]), dad, mom, gc);
    expect(amendmentProgress(v2)).toMatchObject({ priorSigned: 2, priorNeeded: 3, inEffect: false });
  });

  it('takes effect with more than half of the family and the newcomer', () => {
    const { dad, mom, k1, v1 } = ratifiedFamily();
    const gc = party('Grandchild');
    const v2 = signAll(buildFamilyAmendment(dad.identity, v1, [member(gc, 'grandchild')]), dad, mom, k1, gc);
    expect(amendmentProgress(v2)).toMatchObject({ priorSigned: 3, priorNeeded: 3, admitsSigned: 1, inEffect: true });
  });

  it('does not count a forged signature', () => {
    const { dad, mom, k1, v1 } = ratifiedFamily();
    const gc = party('Grandchild');
    const v2 = signAll(buildFamilyAmendment(dad.identity, v1, [member(gc, 'grandchild')]), dad, mom, gc);
    const forged: Attestation = {
      ...v2,
      signatures: [...v2.signatures, { ...v2.signatures[0]!, signer: k1.identity.subject }],
    };
    expect(amendmentProgress(forged)).toMatchObject({ priorSigned: 2, inEffect: false });
  });
});

describe('resolveFamilyLines', () => {
  it('shows one family per line: the old version stays in effect while the new one is proposed', () => {
    const { dad, v1 } = ratifiedFamily();
    const gc = party('Grandchild');
    const v2 = signAll(buildFamilyAmendment(dad.identity, v1, [member(gc, 'grandchild')]), dad);
    const resolved = resolveFamilyLines([v1, v2]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.current).toBe(v1);
    expect(resolved[0]!.proposal).toBe(v2);
  });

  it('switches to the new version once the family agrees, and the proposal clears', () => {
    const { dad, mom, k1, v1 } = ratifiedFamily();
    const gc = party('Grandchild');
    const v2 = signAll(buildFamilyAmendment(dad.identity, v1, [member(gc, 'grandchild')]), dad, mom, k1, gc);
    const [r] = resolveFamilyLines([v1, v2]);
    expect(r!.current).toBe(v2);
    expect(r!.proposal).toBeNull();
  });

  it('a grandchild holding only the pending version sees it as a proposal', () => {
    const { dad, v1 } = ratifiedFamily();
    const gc = party('Grandchild');
    const v2 = signAll(buildFamilyAmendment(dad.identity, v1, [member(gc, 'grandchild')]), dad, gc);
    const [r] = resolveFamilyLines([v2]);
    expect(r!.current).toBeNull();
    expect(r!.proposal).toBe(v2);
  });

  it('rejects a version that quietly drops someone, even with signatures', () => {
    const { dad, mom, k1, k2, k3, v1 } = ratifiedFamily();
    const gc = party('Grandchild');
    // Hand-built "amendment" that lists K3 as gone but claims only to admit the grandchild.
    const sneaky = signAll(
      buildFamilyUnitDraft(
        dad.identity,
        'The Family',
        [member(dad, 'dad'), member(mom, 'mom'), member(k1, 'child'), member(k2, 'child'), member(gc, 'grandchild')],
        {
          family_line: envelopeId(v1),
          supersedes: envelopeId(v1),
          family_version: '2',
          admits: JSON.stringify([gc.identity.subject.toLowerCase()]),
        },
      ),
      dad,
      mom,
      k1,
      gc,
    );
    void k3;
    const [r] = resolveFamilyLines([v1, sneaky]);
    expect(r!.current).toBe(v1);
    expect(r!.proposal).toBeNull();
  });

  it('keeps two separate families separate', () => {
    const a = ratifiedFamily();
    const b = ratifiedFamily();
    expect(resolveFamilyLines([a.v1, b.v1])).toHaveLength(2);
  });
});

describe('familyFanOutTargets', () => {
  it('sends to the founder, every named member and every signer, never to yourself', () => {
    const { dad, mom, k1, k2, k3, v1 } = ratifiedFamily();
    const gc = party('Grandchild');
    const v2 = signAll(buildFamilyAmendment(dad.identity, v1, [member(gc, 'grandchild')]), dad, k1);
    const targets = familyFanOutTargets(v2, [k1.identity.subject.toUpperCase()]);
    const expected = [dad, mom, k2, k3, gc].map((p) => p.identity.subject.toLowerCase()).sort();
    expect([...targets].sort()).toEqual(expected);
  });

  it('skips every key in your history, not only the current one', () => {
    const { dad, mom, v1 } = ratifiedFamily();
    const oldKey = mom.identity.subject;
    const targets = familyFanOutTargets(v1, ['f'.repeat(64), oldKey]);
    expect(targets).not.toContain(oldKey.toLowerCase());
    expect(targets).toContain(dad.identity.subject.toLowerCase());
  });
});
