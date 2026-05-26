import { describe, expect, it } from 'vitest';
import { Wallet, credentialAttestation } from 'tapit-attest';
import type { Attestation } from 'tapit-attest';

import { evaluateJoinPolicy } from './evaluateJoinPolicy.ts';

// Coverage for the Phase 8 Phase E3 cut 1 join-policy evaluator. Each
// policy kind round-trips its accept/reject contract; the deferred
// kinds (handshake / credential / vouch) reject with a reason that
// names Phase E4. The evaluator is pure — no I/O, no wallet calls —
// so the tests construct envelopes via credentialAttestation directly
// and never need wallet.hold or anchorQueue. The case-normalization
// behavior is asserted explicitly: list-checking policies lowercase
// both the joiner's subject and the list entries before comparing, so
// a hex pubkey that arrives mixed-case still matches a lowercase list.

function selfMembershipFrom(joiner: Wallet): Attestation {
  return credentialAttestation({
    subject: joiner.identity,
    tier: 'notable',
    fields: {
      credential_type: 'self_membership',
      org_id: 'org-pubkey-hex',
      org_name: 'American Legion',
      joined_at: '2026-05-26T00:00:00.000Z',
      requested_at: '2026-05-26T00:00:00.000Z',
    },
  });
}

describe('evaluateJoinPolicy — open', () => {
  it('accepts any joiner with reason naming the open policy', () => {
    const joiner = Wallet.generate();
    const env = selfMembershipFrom(joiner);
    const result = evaluateJoinPolicy({ kind: 'open' }, env, []);
    expect(result.accepted).toBe(true);
    expect(result.reason).toMatch(/open/);
  });
});

describe('evaluateJoinPolicy — allow_list', () => {
  it('accepts when the joiner pubkey is on the list', () => {
    const joiner = Wallet.generate();
    const env = selfMembershipFrom(joiner);
    const result = evaluateJoinPolicy(
      { kind: 'allow_list', pubkeys: [joiner.identity, 'unrelated-pubkey'] },
      env,
      [],
    );
    expect(result.accepted).toBe(true);
    expect(result.reason).toMatch(/allow-list/);
  });

  it('rejects when the joiner pubkey is absent from the list', () => {
    const joiner = Wallet.generate();
    const env = selfMembershipFrom(joiner);
    const result = evaluateJoinPolicy(
      { kind: 'allow_list', pubkeys: ['some-other-pubkey'] },
      env,
      [],
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/allow-list/);
  });

  it('normalizes case and whitespace before comparing — mixed-case joiner matches lowercase list', () => {
    const joiner = Wallet.generate();
    const env = selfMembershipFrom(joiner);
    const upper = joiner.identity.toUpperCase();
    const result = evaluateJoinPolicy(
      { kind: 'allow_list', pubkeys: [`  ${upper}  `] },
      env,
      [],
    );
    expect(result.accepted).toBe(true);
  });
});

describe('evaluateJoinPolicy — deny_list', () => {
  it('rejects when the joiner pubkey is on the list', () => {
    const joiner = Wallet.generate();
    const env = selfMembershipFrom(joiner);
    const result = evaluateJoinPolicy(
      { kind: 'deny_list', pubkeys: [joiner.identity] },
      env,
      [],
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/deny-list/);
  });

  it('accepts when the joiner pubkey is absent from the list', () => {
    const joiner = Wallet.generate();
    const env = selfMembershipFrom(joiner);
    const result = evaluateJoinPolicy(
      { kind: 'deny_list', pubkeys: ['banned-pubkey-hex'] },
      env,
      [],
    );
    expect(result.accepted).toBe(true);
    expect(result.reason).toMatch(/deny-list/);
  });
});

describe('evaluateJoinPolicy — proof-required kinds defer to Phase E4', () => {
  it('rejects requires_handshake with reason naming Phase E4', () => {
    const joiner = Wallet.generate();
    const env = selfMembershipFrom(joiner);
    const result = evaluateJoinPolicy(
      { kind: 'requires_handshake', with_any_of: ['anchor-pubkey'] },
      env,
      [],
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/Phase E4/);
  });

  it('rejects requires_credential with reason naming Phase E4', () => {
    const joiner = Wallet.generate();
    const env = selfMembershipFrom(joiner);
    const result = evaluateJoinPolicy(
      { kind: 'requires_credential', credential_type: 'voter_id' },
      env,
      [],
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/Phase E4/);
  });

  it('rejects requires_vouch with reason naming Phase E4', () => {
    const joiner = Wallet.generate();
    const env = selfMembershipFrom(joiner);
    const result = evaluateJoinPolicy(
      { kind: 'requires_vouch', from_any_member_count: 2 },
      env,
      [],
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/Phase E4/);
  });
});
