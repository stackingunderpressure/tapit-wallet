import { describe, it, expect } from 'vitest';
import {
  Wallet,
  identityAttestation,
  credentialAttestation,
  relationshipAttestation,
} from 'tapit-attest';
import type { Attestation } from 'tapit-attest';
import {
  angleFromPubkey,
  CATEGORY_COLOR,
  extractOrgs,
  extractPeers,
  ringPosition,
} from './peopleTreeLayout.ts';

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
): Attestation {
  const fields: Record<string, string> = {
    verification: 'in-person',
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
