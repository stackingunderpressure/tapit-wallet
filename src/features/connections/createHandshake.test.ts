import { describe, it, expect } from 'vitest';
import { Wallet, identityAttestation } from 'tapit-attest';
import type { Attestation } from 'tapit-attest';

import {
  buildAmendedHandshakeDraft,
  buildHandshakeDraft,
  buildRemoteHandshakeDraft,
  dedupeHandshakesByPeer,
  findCompletedHandshakeWith,
  isHandshake,
  isRedundantHandshake,
  readHandshake,
} from './createHandshake.ts';

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

describe('handshake relationship leaf', () => {
  it('round-trips a relationship label through the in-person builder', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const draft = buildHandshakeDraft(alice.identity, bob.identity, 'family');
    const view = readHandshake(draft);
    expect(view.relationship).toBe('family');
    expect(view.verification).toBe('in-person');
  });

  it('round-trips a relationship label through the remote builder', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const draft = buildRemoteHandshakeDraft(
      alice.identity,
      { pubkey: bob.wallet.publicKey, name: 'Bob' },
      'friend',
    );
    const view = readHandshake(draft);
    expect(view.relationship).toBe('friend');
    expect(view.verification).toBe('remote');
  });

  it('omits the leaf when relationship is undefined — back-compat with older handshakes', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const draft = buildHandshakeDraft(alice.identity, bob.identity);
    const view = readHandshake(draft);
    expect(view.relationship).toBe('');
    // Round-trips as a valid handshake regardless of the missing leaf.
    expect(isHandshake(draft)).toBe(true);
  });

  it('omits the leaf when relationship is empty string', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const draft = buildRemoteHandshakeDraft(
      alice.identity,
      { pubkey: bob.wallet.publicKey, name: 'Bob' },
      '',
    );
    const view = readHandshake(draft);
    expect(view.relationship).toBe('');
  });

  it('signed handshake carries the relationship leaf inside the Merkle tree', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const draft = buildHandshakeDraft(alice.identity, bob.identity, 'coworker');
    const signed = bob.wallet.sign(draft);
    // Co-signature by the other party covers the same leaves —
    // both signatures protect the relationship value, so neither
    // party can silently relabel later.
    const cosigned = alice.wallet.sign(signed);
    const view = readHandshake(cosigned);
    expect(view.relationship).toBe('coworker');
    expect(cosigned.signatures.length).toBe(2);
  });
});

describe('findCompletedHandshakeWith', () => {
  it('returns the cosigned handshake when both parties have signed', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const draft = buildHandshakeDraft(alice.identity, bob.identity);
    const cosigned = alice.wallet.sign(bob.wallet.sign(draft));
    const found = findCompletedHandshakeWith(
      [cosigned],
      alice.identity.subject,
      bob.identity.subject,
    );
    expect(found).toBe(cosigned);
  });

  it('returns null when only one side has signed (still pending)', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const oneSig = bob.wallet.sign(
      buildHandshakeDraft(alice.identity, bob.identity),
    );
    expect(
      findCompletedHandshakeWith(
        [oneSig],
        alice.identity.subject,
        bob.identity.subject,
      ),
    ).toBeNull();
  });

  it('returns null when the peer is not party to any handshake in holdings', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const stranger = newWalletAs('Stranger');
    const cosigned = alice.wallet.sign(
      bob.wallet.sign(buildHandshakeDraft(alice.identity, bob.identity)),
    );
    expect(
      findCompletedHandshakeWith(
        [cosigned],
        alice.identity.subject,
        stranger.identity.subject,
      ),
    ).toBeNull();
  });

  it('is party-order-independent — initiator and responder swap roles fine', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    // Bob initiates this time
    const cosigned = bob.wallet.sign(
      alice.wallet.sign(buildHandshakeDraft(bob.identity, alice.identity)),
    );
    const fromAliceSide = findCompletedHandshakeWith(
      [cosigned],
      alice.identity.subject,
      bob.identity.subject,
    );
    const fromBobSide = findCompletedHandshakeWith(
      [cosigned],
      bob.identity.subject,
      alice.identity.subject,
    );
    expect(fromAliceSide).toBe(cosigned);
    expect(fromBobSide).toBe(cosigned);
  });

  it('is case-insensitive on both pubkey arguments', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const cosigned = alice.wallet.sign(
      bob.wallet.sign(buildHandshakeDraft(alice.identity, bob.identity)),
    );
    expect(
      findCompletedHandshakeWith(
        [cosigned],
        alice.identity.subject.toUpperCase(),
        bob.identity.subject.toUpperCase(),
      ),
    ).toBe(cosigned);
  });

  it('returns null when myIdentity equals peerPubkey (defensive)', () => {
    const alice = newWalletAs('Alice');
    expect(
      findCompletedHandshakeWith(
        [],
        alice.identity.subject,
        alice.identity.subject,
      ),
    ).toBeNull();
  });
});

describe('dedupeHandshakesByPeer', () => {
  it('returns empty when there are no handshakes', () => {
    const alice = newWalletAs('Alice');
    expect(dedupeHandshakesByPeer([], alice.identity.subject)).toEqual([]);
  });

  it('prefers the cosigned envelope over a stale 1-sig draft for the same peer', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const stale = alice.wallet.sign(
      buildHandshakeDraft(alice.identity, bob.identity),
    );
    // Different envelope (different handshake_at) so a separate envelopeId
    const second = buildHandshakeDraft(alice.identity, bob.identity);
    const cosigned = alice.wallet.sign(bob.wallet.sign(second));
    const out = dedupeHandshakesByPeer([stale, cosigned], alice.identity.subject);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(cosigned);
  });

  it('keeps a single handshake when there is no duplicate to compete with', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const only = alice.wallet.sign(
      bob.wallet.sign(buildHandshakeDraft(alice.identity, bob.identity)),
    );
    const out = dedupeHandshakesByPeer([only], alice.identity.subject);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(only);
  });

  it('returns one card per peer when several distinct peers each have one handshake', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const carol = newWalletAs('Carol');
    const aliceBob = alice.wallet.sign(
      bob.wallet.sign(buildHandshakeDraft(alice.identity, bob.identity)),
    );
    const aliceCarol = alice.wallet.sign(
      carol.wallet.sign(buildHandshakeDraft(alice.identity, carol.identity)),
    );
    const out = dedupeHandshakesByPeer(
      [aliceBob, aliceCarol],
      alice.identity.subject,
    );
    expect(out).toHaveLength(2);
  });

  it('filters out handshakes that do not name the operator as a party', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const carol = newWalletAs('Carol');
    const bobCarol = bob.wallet.sign(
      carol.wallet.sign(buildHandshakeDraft(bob.identity, carol.identity)),
    );
    const out = dedupeHandshakesByPeer([bobCarol], alice.identity.subject);
    expect(out).toEqual([]);
  });
});

describe('buildRemoteHandshakeDraft family_hint leaf', () => {
  it('omits family_hint when none is given', () => {
    const a = newWalletAs('A');
    const b = newWalletAs('B');
    const draft = buildRemoteHandshakeDraft(a.identity, {
      pubkey: b.identity.subject,
      name: 'B',
    });
    expect(readHandshake(draft).familyHint).toBe('');
  });

  it('carries the family name through a sign + read round-trip', () => {
    const a = newWalletAs('A');
    const b = newWalletAs('B');
    const draft = buildRemoteHandshakeDraft(
      a.identity,
      { pubkey: b.identity.subject, name: 'B' },
      'family',
      'The Lovelaces',
    );
    const signed = a.wallet.sign(draft);
    expect(isHandshake(signed)).toBe(true);
    expect(readHandshake(signed).familyHint).toBe('The Lovelaces');
    expect(readHandshake(signed).relationship).toBe('family');
  });

  it('the family_hint is covered by both signatures (co-signer sees it)', () => {
    const a = newWalletAs('A');
    const b = newWalletAs('B');
    const draft = buildRemoteHandshakeDraft(
      a.identity,
      { pubkey: b.identity.subject, name: 'B' },
      'family',
      'Crew',
    );
    const cosigned = b.wallet.sign(a.wallet.sign(draft));
    expect(cosigned.signatures.length).toBe(2);
    expect(readHandshake(cosigned).familyHint).toBe('Crew');
  });

  it('met_in_person: absent by default, set when self-attested, covered by both sigs', () => {
    const a = newWalletAs('A');
    const b = newWalletAs('B');
    const plain = buildRemoteHandshakeDraft(a.identity, {
      pubkey: b.identity.subject,
      name: 'B',
    });
    expect(readHandshake(plain).metInPerson).toBe(false);

    const attested = buildRemoteHandshakeDraft(
      a.identity,
      { pubkey: b.identity.subject, name: 'B' },
      'friend',
      undefined,
      true,
    );
    expect(readHandshake(attested).metInPerson).toBe(true);
    expect(readHandshake(attested).verification).toBe('remote');
    const cosigned = b.wallet.sign(a.wallet.sign(attested));
    expect(cosigned.signatures.length).toBe(2);
    expect(readHandshake(cosigned).metInPerson).toBe(true);
  });
});

describe('buildAmendedHandshakeDraft', () => {
  it('preserves parties, verification, and the original handshake_at while changing the relationship', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const original = alice.wallet.sign(
      bob.wallet.sign(buildHandshakeDraft(alice.identity, bob.identity, 'acquaintance')),
    );
    const existing = readHandshake(original);
    const amendment = buildAmendedHandshakeDraft(existing, 'family');
    const view = readHandshake(amendment);
    expect(view.relationship).toBe('family');
    expect(view.initiatorId).toBe(existing.initiatorId);
    expect(view.responderId).toBe(existing.responderId);
    expect(view.verification).toBe(existing.verification);
    expect(view.handshakeAt).toBe(existing.handshakeAt);
    expect(view.amendedAt.length).toBeGreaterThan(0);
  });

  it('an amendment is a genuinely different envelope from the original', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const original = alice.wallet.sign(
      bob.wallet.sign(buildHandshakeDraft(alice.identity, bob.identity, 'acquaintance')),
    );
    const amendment = buildAmendedHandshakeDraft(readHandshake(original), 'family');
    expect(amendment.claim).not.toEqual(original.claim);
  });

  it('carries forward metInPerson and familyHint from the original', () => {
    const a = newWalletAs('A');
    const b = newWalletAs('B');
    const original = a.wallet.sign(
      buildRemoteHandshakeDraft(
        a.identity,
        { pubkey: b.identity.subject, name: 'B' },
        'friend',
        'The Lovelaces',
        true,
      ),
    );
    const amendment = buildAmendedHandshakeDraft(readHandshake(original), 'family');
    const view = readHandshake(amendment);
    expect(view.metInPerson).toBe(true);
    expect(view.familyHint).toBe('The Lovelaces');
    expect(view.relationship).toBe('family');
  });

  it('omits the relationship leaf when amending to no label', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const original = alice.wallet.sign(
      bob.wallet.sign(buildHandshakeDraft(alice.identity, bob.identity, 'family')),
    );
    const amendment = buildAmendedHandshakeDraft(readHandshake(original), '');
    expect(readHandshake(amendment).relationship).toBe('');
  });

  it('both parties cosigning an amendment covers the new relationship and the amended_at stamp', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const original = alice.wallet.sign(
      bob.wallet.sign(buildHandshakeDraft(alice.identity, bob.identity, 'acquaintance')),
    );
    const draft = buildAmendedHandshakeDraft(readHandshake(original), 'family');
    const cosigned = bob.wallet.sign(alice.wallet.sign(draft));
    expect(cosigned.signatures.length).toBe(2);
    expect(readHandshake(cosigned).relationship).toBe('family');
  });
});

describe('isRedundantHandshake', () => {
  it('is false for a first-ever connection (nothing to compare against)', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const incoming = bob.wallet.sign(buildHandshakeDraft(alice.identity, bob.identity, 'family'));
    expect(isRedundantHandshake(incoming, [], alice.identity.subject, bob.identity.subject)).toBe(false);
  });

  it('is true when the incoming handshake matches an already-completed one exactly (a real relay replay)', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const completed = alice.wallet.sign(
      bob.wallet.sign(buildHandshakeDraft(alice.identity, bob.identity, 'family')),
    );
    // The relay redelivers bob's original 1-sig copy after the connection
    // already completed.
    const replay = bob.wallet.sign(buildHandshakeDraft(alice.identity, bob.identity, 'family'));
    expect(
      isRedundantHandshake(replay, [completed], alice.identity.subject, bob.identity.subject),
    ).toBe(true);
  });

  it('is FALSE when an amendment changes the relationship, even though a completed handshake with that peer exists — the core fix', () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const completed = alice.wallet.sign(
      bob.wallet.sign(buildHandshakeDraft(alice.identity, bob.identity, 'acquaintance')),
    );
    const amendment = bob.wallet.sign(
      buildAmendedHandshakeDraft(readHandshake(completed), 'family'),
    );
    expect(
      isRedundantHandshake(amendment, [completed], alice.identity.subject, bob.identity.subject),
    ).toBe(false);
  });

  it('is false when only met_in_person differs', () => {
    const a = newWalletAs('A');
    const b = newWalletAs('B');
    const completed = a.wallet.sign(
      b.wallet.sign(
        buildRemoteHandshakeDraft(a.identity, { pubkey: b.identity.subject, name: 'B' }, 'friend'),
      ),
    );
    const amendment = b.wallet.sign(
      buildAmendedHandshakeDraft({ ...readHandshake(completed), metInPerson: true }, 'friend'),
    );
    expect(isRedundantHandshake(amendment, [completed], a.identity.subject, b.identity.subject)).toBe(false);
  });

  it('is false for a non-handshake attestation', () => {
    const alice = newWalletAs('Alice');
    expect(isRedundantHandshake(alice.identity, [], alice.identity.subject, 'somepeer')).toBe(false);
  });
});
