import { describe, expect, it } from 'vitest';
import { Wallet, credentialAttestation } from 'tapit-attest';
import type { Attestation } from 'tapit-attest';

import {
  countRatifications,
  findLatestOfficialsRoster,
  isOfficialsRoster,
  publishOfficialsRoster,
  readOfficials,
  type Official,
} from './officialsRoster.ts';

// Coverage for the officials-roster + ratifications helpers extracted
// from createOrganization.ts. Pure helpers (predicate, reader,
// latest-by-issuedAt selection, ratification cross-reference) are
// exercised by constructing roster envelopes via credentialAttestation
// directly + signing with raw wallets — same envelope shape
// publishOfficialsRoster emits one step earlier in the chain. The
// publish wrapper itself threads anchorQueue.upsert which jsdom does
// not back; tests that need to exercise the validation gate stop
// BEFORE the IndexedDB call by passing an invalid pubkey that throws
// at the gate.

function pubkeyHex64(seed: number): string {
  // Deterministic 64-char hex for tests that want a stable
  // sortable-pubkey-shaped string without spending an actual key.
  const s = seed.toString(16).padStart(2, '0');
  return s.repeat(32);
}

function buildSignedRoster(
  org: Wallet,
  officials: readonly Official[],
  issuedAt: string,
): Attestation {
  return org.sign(
    credentialAttestation({
      subject: org.identity,
      tier: 'notable',
      fields: {
        credential_type: 'officials',
        org_id: org.identity,
        officials,
        issued_at: issuedAt,
      },
    }),
  );
}

describe('isOfficialsRoster', () => {
  it('returns true for an officials-roster envelope', () => {
    const org = Wallet.generate();
    const roster = buildSignedRoster(org, [], '2026-05-26T00:00:00.000Z');
    expect(isOfficialsRoster(roster)).toBe(true);
  });

  it('returns false for any other credential kind', () => {
    const org = Wallet.generate();
    const other = org.sign(
      credentialAttestation({
        subject: org.identity,
        tier: 'notable',
        fields: { credential_type: 'membership', org_id: org.identity },
      }),
    );
    expect(isOfficialsRoster(other)).toBe(false);
  });
});

describe('readOfficials', () => {
  it('round-trips a list of officials through the canonical JSON leaf', () => {
    const org = Wallet.generate();
    const officials: Official[] = [
      { pubkey: pubkeyHex64(0xab), name: 'Alex' },
      { pubkey: pubkeyHex64(0xcd), name: 'Sam' },
    ];
    const roster = buildSignedRoster(org, officials, '2026-05-26T00:00:00.000Z');

    const read = readOfficials(roster);
    expect(read.length).toBe(2);
    expect(read.map((o) => o.pubkey).sort()).toEqual(
      [pubkeyHex64(0xab), pubkeyHex64(0xcd)].sort(),
    );
    expect(read.map((o) => o.name).sort()).toEqual(['Alex', 'Sam']);
  });

  it('drops entries whose pubkey is not 64-character hex', () => {
    const org = Wallet.generate();
    const officials: Official[] = [
      { pubkey: pubkeyHex64(0xab), name: 'Valid' },
      { pubkey: 'too-short', name: 'Skip' },
      { pubkey: pubkeyHex64(0xcd) + 'extra', name: 'Skip too' },
    ];
    const roster = buildSignedRoster(org, officials, '2026-05-26T00:00:00.000Z');

    const read = readOfficials(roster);
    expect(read.length).toBe(1);
    expect(read[0]?.name).toBe('Valid');
  });

  it('returns empty array when the officials leaf is absent', () => {
    const org = Wallet.generate();
    const bare = org.sign(
      credentialAttestation({
        subject: org.identity,
        tier: 'notable',
        fields: { credential_type: 'officials', org_id: org.identity },
      }),
    );
    expect(readOfficials(bare)).toEqual([]);
  });

  it('returns empty array on a malformed officials leaf (not JSON)', () => {
    const org = Wallet.generate();
    const malformed = org.sign(
      credentialAttestation({
        subject: org.identity,
        tier: 'notable',
        fields: {
          credential_type: 'officials',
          org_id: org.identity,
          officials: 'not-json',
        },
      }),
    );
    expect(readOfficials(malformed)).toEqual([]);
  });

  it('lowercases pubkeys on read', () => {
    const org = Wallet.generate();
    const uppercase = pubkeyHex64(0xab).toUpperCase();
    const officials = [{ pubkey: uppercase, name: 'Alex' }];
    const roster = buildSignedRoster(org, officials, '2026-05-26T00:00:00.000Z');

    const read = readOfficials(roster);
    expect(read[0]?.pubkey).toBe(uppercase.toLowerCase());
  });
});

describe('findLatestOfficialsRoster', () => {
  it('returns the most recent roster by issued_at', () => {
    const org = Wallet.generate();
    const older = buildSignedRoster(
      org,
      [{ pubkey: pubkeyHex64(0xab), name: 'A' }],
      '2026-05-20T00:00:00.000Z',
    );
    const newer = buildSignedRoster(
      org,
      [{ pubkey: pubkeyHex64(0xcd), name: 'B' }],
      '2026-05-26T00:00:00.000Z',
    );
    expect(findLatestOfficialsRoster([older, newer], org.identity)).toBe(newer);
    expect(findLatestOfficialsRoster([newer, older], org.identity)).toBe(newer);
  });

  it('returns null when no roster is held for the named org', () => {
    const orgA = Wallet.generate();
    const orgB = Wallet.generate();
    const aRoster = buildSignedRoster(orgA, [], '2026-05-26T00:00:00.000Z');
    expect(findLatestOfficialsRoster([aRoster], orgB.identity)).toBeNull();
  });

  it('skips rosters where the org has not signed (subject mismatch)', () => {
    const org = Wallet.generate();
    const stranger = Wallet.generate();
    // Build the roster as a credential whose subject is the org, but
    // sign only with stranger — the subject-binding gate inside
    // findLatestOfficialsRoster rejects it because the org never
    // co-signed.
    const orphaned = stranger.sign(
      credentialAttestation({
        subject: org.identity,
        tier: 'notable',
        fields: {
          credential_type: 'officials',
          org_id: org.identity,
          officials: [],
          issued_at: '2026-05-26T00:00:00.000Z',
        },
      }),
    );
    expect(findLatestOfficialsRoster([orphaned], org.identity)).toBeNull();
  });

  it('returns null on holdings with no officials rosters at all', () => {
    const org = Wallet.generate();
    const membership = org.sign(
      credentialAttestation({
        subject: org.identity,
        tier: 'notable',
        fields: { credential_type: 'membership', org_id: org.identity },
      }),
    );
    expect(findLatestOfficialsRoster([membership], org.identity)).toBeNull();
  });
});

describe('countRatifications', () => {
  it('counts officials whose signatures appear on the envelope', () => {
    const officials: Official[] = [
      { pubkey: pubkeyHex64(0xab), name: 'Alex' },
      { pubkey: pubkeyHex64(0xcd), name: 'Sam' },
      { pubkey: pubkeyHex64(0xef), name: 'Pat' },
    ];
    const envelope: Attestation = {
      v: 1,
      kind: 'credential',
      tier: 'notable',
      subject: 'subject-pubkey',
      issuedAt: '2026-05-26T00:00:00.000Z',
      claim: { node: 'branch', name: 'root', children: [] },
      signatures: [
        { signer: pubkeyHex64(0xab), sig: 'sig-a' },
        { signer: pubkeyHex64(0xef), sig: 'sig-c' },
      ],
    };
    const summary = countRatifications(envelope, officials);
    expect(summary).not.toBeNull();
    expect(summary?.total).toBe(3);
    expect(summary?.ratified).toBe(2);
    expect(summary?.byName).toEqual(['Alex', 'Pat']);
  });

  it('returns null when the officials list is empty', () => {
    const envelope: Attestation = {
      v: 1,
      kind: 'credential',
      tier: 'notable',
      subject: 'subject-pubkey',
      issuedAt: '2026-05-26T00:00:00.000Z',
      claim: { node: 'branch', name: 'root', children: [] },
      signatures: [{ signer: pubkeyHex64(0xab), sig: 'sig-a' }],
    };
    expect(countRatifications(envelope, [])).toBeNull();
  });

  it('falls back to a pubkey prefix label when an official has no name', () => {
    const pk = pubkeyHex64(0xab);
    const officials: Official[] = [{ pubkey: pk, name: '' }];
    const envelope: Attestation = {
      v: 1,
      kind: 'credential',
      tier: 'notable',
      subject: 'subject-pubkey',
      issuedAt: '2026-05-26T00:00:00.000Z',
      claim: { node: 'branch', name: 'root', children: [] },
      signatures: [{ signer: pk, sig: 'sig' }],
    };
    const summary = countRatifications(envelope, officials);
    expect(summary?.byName[0]).toMatch(/…/);
    expect(summary?.byName[0]).toContain(pk.slice(0, 8));
    expect(summary?.byName[0]).toContain(pk.slice(-4));
  });
});

describe('publishOfficialsRoster — validation gate', () => {
  it('throws before the IndexedDB layer when an official pubkey is not 64-char hex', async () => {
    const org = Wallet.generate();
    const bad: Official[] = [{ pubkey: 'not-hex-64-long', name: 'Bad' }];
    await expect(
      publishOfficialsRoster(org, org.identity, null, bad),
    ).rejects.toThrow(/not 64-character hex/);
  });

  it('throws on the malformed entry even when other entries are valid', async () => {
    const org = Wallet.generate();
    const mixed: Official[] = [
      { pubkey: pubkeyHex64(0xab), name: 'Good' },
      { pubkey: 'bad', name: 'Bad' },
    ];
    await expect(
      publishOfficialsRoster(org, org.identity, null, mixed),
    ).rejects.toThrow(/not 64-character hex/);
  });
});
