import { describe, it, expect } from 'vitest';
import { Wallet, identityAttestation } from 'tapit-attest';
import type { Attestation } from 'tapit-attest';

import {
  buildHandshakeDraft,
  buildRemoteHandshakeDraft,
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
