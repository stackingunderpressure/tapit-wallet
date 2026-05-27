import { describe, it, expect } from 'vitest';
import { Wallet, identityAttestation } from 'tapit-attest';
import type { Attestation } from 'tapit-attest';

import {
  buildHandshakeDraft,
  buildRemoteHandshakeDraft,
  findCompletedHandshakeWith,
  isHandshake,
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
