import { describe, it, expect } from 'vitest';
import {
  Wallet,
  envelopeId,
  identityAttestation,
  credentialAttestation,
  relationshipAttestation,
} from 'tapit-attest';
import type { Attestation } from 'tapit-attest';
import {
  angleFromPubkey,
  CATEGORY_COLOR,
  extractFamilies,
  extractOrgs,
  extractPeers,
  ringPosition,
} from './peopleTreeLayout.ts';
import { buildFamilyUnitDraft } from './familyUnit.ts';

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

function signedHandshake(
  initiator: { wallet: Wallet; identity: Attestation },
  responder: { wallet: Wallet; identity: Attestation },
  relationship?: string,
  verification: string = 'in-person',
): Attestation {
  const fields: Record<string, string> = {
    verification,
    handshake_at: new Date().toISOString(),
    initiator_id: initiator.identity.subject,
    initiator_name: 'I',
    responder_id: responder.identity.subject,
    responder_name: 'R',
  };
  if (relationship) fields.relationship = relationship;
  const draft = relationshipAttestation({
    subject: initiator.identity.subject,
    tier: 'notable',
    fields,
  });
  return responder.wallet.sign(initiator.wallet.sign(draft));
}

function signedMembership(
  org: { wallet: Wallet; identity: Attestation },
  member: { wallet: Wallet; identity: Attestation },
): Attestation {
  return org.wallet.sign(
    credentialAttestation({
      subject: member.identity.subject,
      tier: 'notable',
      fields: {
        credential_type: 'membership',
        org_id: org.identity.subject,
        org_name: 'TestOrg',
        member_id: member.identity.subject,
        member_name: 'M',
        issued_at: new Date().toISOString(),
      },
    }),
  );
}

describe('angleFromPubkey', () => {
  it('returns the same angle for the same pubkey on repeated calls', () => {
    const a = angleFromPubkey('abc123def456');
    const b = angleFromPubkey('abc123def456');
    expect(a).toBe(b);
  });

  it('is case-insensitive — uppercase and lowercase yield the same angle', () => {
    const lower = angleFromPubkey('abcdef0123456789');
    const upper = angleFromPubkey('ABCDEF0123456789');
    expect(lower).toBe(upper);
  });

  it('returns an angle in [0, 2π)', () => {
    for (let i = 0; i < 20; i++) {
      const pk = `${i.toString(16).padStart(64, '0')}`;
      const a = angleFromPubkey(pk);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(2 * Math.PI);
    }
  });

  it('produces different angles for different pubkeys (best-effort)', () => {
    const seen = new Set<number>();
    let collisions = 0;
    for (let i = 0; i < 100; i++) {
      const a = angleFromPubkey(`pk${i}`);
      if (seen.has(a)) collisions += 1;
      seen.add(a);
    }
    expect(collisions).toBeLessThan(20);
  });
});

describe('ringPosition', () => {
  it('places a node at angle 0 directly right of center', () => {
    const pos = ringPosition(100, 100, 50, 0);
    expect(pos.x).toBeCloseTo(150);
    expect(pos.y).toBeCloseTo(100);
  });

  it('places a node at angle π/2 directly below center', () => {
    const pos = ringPosition(100, 100, 50, Math.PI / 2);
    expect(pos.x).toBeCloseTo(100);
    expect(pos.y).toBeCloseTo(150);
  });

  it('places a node at angle π directly left of center', () => {
    const pos = ringPosition(100, 100, 50, Math.PI);
    expect(pos.x).toBeCloseTo(50);
    expect(pos.y).toBeCloseTo(100);
  });
});

describe('extractPeers', () => {
  it('returns empty when there are no handshakes in holdings', () => {
    const alice = newWalletAs('Alice');
    expect(extractPeers([], alice.identity.subject)).toEqual([]);
    expect(extractPeers([alice.identity], alice.identity.subject)).toEqual([]);
  });

  it('returns the responder when the operator is the initiator', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const h = signedHandshake(alice, bob);
    const peers = extractPeers([h], alice.identity.subject);
    expect(peers).toHaveLength(1);
    expect(peers[0]?.pubkey).toBe(bob.identity.subject.toLowerCase());
  });

  it('carries the verification tier (A1 — drives in-person vs online edge style)', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const carol = newWalletAs('Carol');
    const inPerson = signedHandshake(alice, bob);
    const remote = signedHandshake(alice, carol, 'friend', 'remote');
    const peers = extractPeers([inPerson, remote], alice.identity.subject);
    const byKey = Object.fromEntries(peers.map((p) => [p.pubkey, p.verification]));
    expect(byKey[bob.identity.subject.toLowerCase()]).toBe('in-person');
    expect(byKey[carol.identity.subject.toLowerCase()]).toBe('remote');
  });

  it('returns the initiator when the operator is the responder', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const h = signedHandshake(alice, bob);
    const peers = extractPeers([h], bob.identity.subject);
    expect(peers).toHaveLength(1);
    expect(peers[0]?.pubkey).toBe(alice.identity.subject.toLowerCase());
  });

  it('deduplicates when the operator has more than one handshake with the same peer', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const h1 = signedHandshake(alice, bob);
    const h2 = signedHandshake(alice, bob, 'friend');
    const peers = extractPeers([h1, h2], alice.identity.subject);
    expect(peers).toHaveLength(1);
  });

  it('categorizes family relationships under the family bucket', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const h = signedHandshake(alice, bob, 'spouse');
    const peers = extractPeers([h], alice.identity.subject);
    expect(peers[0]?.category).toBe('family');
  });

  it('categorizes friend / coworker / acquaintance correctly', () => {
    const me = newWalletAs('Me');
    const f = newWalletAs('Friend');
    const c = newWalletAs('Coworker');
    const a = newWalletAs('Acq');
    const peers = extractPeers(
      [
        signedHandshake(me, f, 'friend'),
        signedHandshake(me, c, 'coworker'),
        signedHandshake(me, a, 'acquaintance'),
      ],
      me.identity.subject,
    );
    const byPk = new Map(peers.map((p) => [p.pubkey, p.category]));
    expect(byPk.get(f.identity.subject.toLowerCase())).toBe('friend');
    expect(byPk.get(c.identity.subject.toLowerCase())).toBe('coworker');
    expect(byPk.get(a.identity.subject.toLowerCase())).toBe('acquaintance');
  });

  it("falls back to 'other' when the relationship leaf is empty or unknown", () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const h = signedHandshake(alice, bob);
    const peers = extractPeers([h], alice.identity.subject);
    expect(peers[0]?.category).toBe('other');
  });

  it('assigns each peer a stable angle from their pubkey hash', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const h = signedHandshake(alice, bob);
    const peers = extractPeers([h], alice.identity.subject);
    expect(peers[0]?.angle).toBeCloseTo(
      angleFromPubkey(bob.identity.subject),
    );
  });
});

describe('extractOrgs', () => {
  it('returns memberships where the operator is the member', () => {
    const me = newWalletAs('Me');
    const org = newWalletAs('Org');
    const m = signedMembership(org, me);
    const orgs = extractOrgs([m], me.identity.subject);
    expect(orgs).toHaveLength(1);
    expect(orgs[0]?.pubkey).toBe(org.identity.subject.toLowerCase());
    expect(orgs[0]?.name).toBe('TestOrg');
  });

  it('excludes memberships where the operator is the issuing org, not the member', () => {
    const me = newWalletAs('Me');
    const someone = newWalletAs('Other');
    const m = signedMembership(me, someone);
    const orgs = extractOrgs([m], me.identity.subject);
    expect(orgs).toHaveLength(0);
  });

  it('deduplicates when the operator holds more than one membership in the same org', () => {
    const me = newWalletAs('Me');
    const org = newWalletAs('Org');
    const m1 = signedMembership(org, me);
    const m2 = signedMembership(org, me);
    const orgs = extractOrgs([m1, m2], me.identity.subject);
    expect(orgs).toHaveLength(1);
  });

  it('assigns each org a stable angle from its pubkey hash', () => {
    const me = newWalletAs('Me');
    const org = newWalletAs('Org');
    const m = signedMembership(org, me);
    const orgs = extractOrgs([m], me.identity.subject);
    expect(orgs[0]?.angle).toBeCloseTo(angleFromPubkey(org.identity.subject));
  });
});

describe('CATEGORY_COLOR', () => {
  it('defines a color for every PeerCategory', () => {
    expect(CATEGORY_COLOR.family).toMatch(/^#[0-9a-f]{6}$/i);
    expect(CATEGORY_COLOR.friend).toMatch(/^#[0-9a-f]{6}$/i);
    expect(CATEGORY_COLOR.coworker).toMatch(/^#[0-9a-f]{6}$/i);
    expect(CATEGORY_COLOR.acquaintance).toMatch(/^#[0-9a-f]{6}$/i);
    expect(CATEGORY_COLOR.other).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('extractFamilies', () => {
  // Helper: build a founder-signed family-unit attestation. Founder is
  // always the first wallet; named members include the operator.
  function signedFamily(
    founder: { wallet: Wallet; identity: Attestation },
    familyName: string,
    members: { wallet: Wallet; identity: Attestation; role: 'parent' | 'child' | 'spouse' }[],
    extraSigners: Wallet[] = [],
  ): Attestation {
    const draft = buildFamilyUnitDraft(
      founder.identity,
      familyName,
      members.map((m) => ({
        pubkey: m.wallet.identity,
        name: 'Member',
        role: m.role,
      })),
    );
    let env = founder.wallet.sign(draft);
    for (const w of extraSigners) env = w.sign(env);
    return env;
  }

  it('returns empty when the operator is not named in any family unit', () => {
    const me = newWalletAs('Me');
    const stranger = newWalletAs('Stranger');
    const family = signedFamily(stranger, 'Their Family', [
      { wallet: stranger.wallet, identity: stranger.identity, role: 'parent' },
    ]);
    const out = extractFamilies([family], me.identity.subject);
    expect(out).toEqual([]);
  });

  it('returns a family the operator is named in (as founder)', () => {
    const me = newWalletAs('Me');
    const kid = newWalletAs('Kid');
    const family = signedFamily(me, 'The Hearth', [
      { wallet: me.wallet, identity: me.identity, role: 'parent' },
      { wallet: kid.wallet, identity: kid.identity, role: 'child' },
    ]);
    const out = extractFamilies([family], me.identity.subject);
    expect(out).toHaveLength(1);
    expect(out[0]?.familyName).toBe('The Hearth');
    expect(out[0]?.memberCount).toBe(2);
    expect(out[0]?.founderId).toBe(me.identity.subject.toLowerCase());
  });

  it('returns a family the operator is named in (as a non-founder member)', () => {
    const founder = newWalletAs('Founder');
    const me = newWalletAs('Me');
    const family = signedFamily(founder, 'The Hearth', [
      { wallet: founder.wallet, identity: founder.identity, role: 'parent' },
      { wallet: me.wallet, identity: me.identity, role: 'child' },
    ]);
    const out = extractFamilies([family], me.identity.subject);
    expect(out).toHaveLength(1);
    expect(out[0]?.founderId).toBe(founder.identity.subject.toLowerCase());
  });

  it('returns both birth-family and chosen-family when the operator is in both', () => {
    const me = newWalletAs('Me');
    const parent = newWalletAs('Parent');
    const partner = newWalletAs('Partner');
    const birth = signedFamily(parent, 'Birth', [
      { wallet: parent.wallet, identity: parent.identity, role: 'parent' },
      { wallet: me.wallet, identity: me.identity, role: 'child' },
    ]);
    const chosen = signedFamily(me, 'Chosen', [
      { wallet: me.wallet, identity: me.identity, role: 'spouse' },
      { wallet: partner.wallet, identity: partner.identity, role: 'spouse' },
    ]);
    const out = extractFamilies([birth, chosen], me.identity.subject);
    expect(out).toHaveLength(2);
    const names = out.map((f) => f.familyName).sort();
    expect(names).toEqual(['Birth', 'Chosen']);
  });

  it('counts ratification progress against the named members', () => {
    const founder = newWalletAs('Founder');
    const me = newWalletAs('Me');
    const other = newWalletAs('Other');
    // founder + me sign, other has not yet ratified
    const family = signedFamily(
      founder,
      'Two Of Three',
      [
        { wallet: founder.wallet, identity: founder.identity, role: 'parent' },
        { wallet: me.wallet, identity: me.identity, role: 'child' },
        { wallet: other.wallet, identity: other.identity, role: 'child' },
      ],
      [me.wallet],
    );
    const out = extractFamilies([family], me.identity.subject);
    expect(out[0]?.memberCount).toBe(3);
    expect(out[0]?.signedCount).toBe(2);
  });

  it('assigns each family a stable angle from its envelopeId hash', () => {
    const founder = newWalletAs('Founder');
    const me = newWalletAs('Me');
    const family = signedFamily(founder, 'Stable', [
      { wallet: founder.wallet, identity: founder.identity, role: 'parent' },
      { wallet: me.wallet, identity: me.identity, role: 'child' },
    ]);
    const out = extractFamilies([family], me.identity.subject);
    expect(out[0]?.angle).toBeCloseTo(angleFromPubkey(envelopeId(family)));
  });

  it('credits the operator signature when keyAliases bridges a rotated key', () => {
    // The operator signs with their genesis key, then rotates. The
    // active key differs from the genesis identity in members[].
    // Without keyAliases the genesis-signed signature still matches
    // (signer === genesis), so the bridge matters most when the
    // founder is rotated AND signed after rotation. Simulate that
    // by signing with a SECOND wallet whose pubkey we'll register as
    // an alias of the founder's identity.
    const founder = newWalletAs('Founder');
    const rotatedKey = Wallet.generate();
    const me = newWalletAs('Me');
    const draft = buildFamilyUnitDraft(founder.identity, 'Rotated', [
      { pubkey: founder.identity.subject, name: 'Founder', role: 'parent' },
      { pubkey: me.identity.subject, name: 'Me', role: 'child' },
    ]);
    // The rotated key signs (not the founder's own wallet). Without
    // keyAliases the founder appears unsigned.
    const env = rotatedKey.sign(draft);

    const without = extractFamilies([env], me.identity.subject);
    expect(without[0]?.signedCount).toBe(0);

    const aliases = new Map<string, readonly string[]>([
      [
        founder.identity.subject.toLowerCase(),
        [rotatedKey.publicKey.toLowerCase()],
      ],
    ]);
    const withAliases = extractFamilies([env], me.identity.subject, aliases);
    expect(withAliases[0]?.signedCount).toBe(1);
  });
});
