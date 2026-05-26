import { describe, expect, it } from 'vitest';
import {
  Wallet,
  credentialAttestation,
  disclosureProof,
  identityAttestation,
  relationshipAttestation,
} from 'tapit-attest';
import type { Attestation } from 'tapit-attest';

import { evaluateJoinPolicy } from './evaluateJoinPolicy.ts';

// Coverage for the Phase 8 Phase E3 cut 1 join-policy evaluator,
// extended in Phase E4 cut 2 to actually evaluate the three
// proof-required policy kinds (requires_handshake /
// requires_credential / requires_vouch). The list-checking kinds
// (open / allow_list / deny_list) evaluate from the envelope alone.
// The proof-required kinds read leaves the Phase E4 cut 2 builder
// bakes onto the self-membership envelope: handshake_proof and
// credential_proof are JSON-stringified DisclosureProofBundles that
// the evaluator parses, validates structurally, then runs
// verifyDisclosureProof against; vouch counts cosigners on
// envelope.signatures[] and intersects them with the org's
// known-member set derived from holdings. The evaluator stays pure —
// no I/O, no wallet calls — so tests construct envelopes via
// credentialAttestation / relationshipAttestation directly and never
// need wallet.hold or anchorQueue. Case-normalization behavior is
// asserted explicitly on the list-checking kinds; the
// proof-validating kinds re-normalize signer hex internally.

function selfMembershipFrom(joiner: Wallet, orgId = 'org-pubkey-hex'): Attestation {
  return credentialAttestation({
    subject: joiner.identity,
    tier: 'notable',
    fields: {
      credential_type: 'self_membership',
      org_id: orgId,
      org_name: 'American Legion',
      joined_at: '2026-05-26T00:00:00.000Z',
      requested_at: '2026-05-26T00:00:00.000Z',
    },
  });
}

function signedIdentity(w: Wallet, name: string): Attestation {
  return w.sign(
    identityAttestation({
      subject: w.identity,
      tier: 'notable',
      fields: { display_name: name },
    }),
  );
}

/** Build + co-sign a handshake-shape relationship attestation between
 *  two wallets, then return a disclosureProof bundle for its
 *  `verification` leaf — the shape Phase E4 cut 2 expects on
 *  requires_handshake's handshake_proof leaf. */
function handshakeProofBetween(a: Wallet, b: Wallet): Attestation {
  const draft = relationshipAttestation({
    subject: a.identity,
    tier: 'notable',
    fields: {
      verification: 'in-person',
      handshake_at: '2026-05-26T00:00:00.000Z',
      initiator_id: a.identity,
      initiator_name: 'A',
      responder_id: b.identity,
      responder_name: 'B',
    },
  });
  const dual = b.sign(a.sign(draft));
  return dual;
}

/** Build + sign a credential-kind attestation with the named
 *  credential_type leaf, then return a disclosureProof bundle for
 *  that leaf — the shape Phase E4 cut 2 expects on
 *  requires_credential's credential_proof leaf. */
function credentialProofFor(holder: Wallet, issuer: Wallet, credType: string): Attestation {
  const draft = credentialAttestation({
    subject: holder.identity,
    tier: 'notable',
    fields: {
      credential_type: credType,
      issued_at: '2026-05-26T00:00:00.000Z',
    },
  });
  return issuer.sign(draft);
}

function withProofLeaf(env: Attestation, leafName: string, proof: unknown): Attestation {
  // The evaluator reads the proof leaf off the self-membership claim
  // tree; tests construct that envelope here by rebuilding the same
  // credentialAttestation shape and adding the JSON-stringified proof.
  return credentialAttestation({
    subject: env.subject,
    tier: 'notable',
    fields: Object.fromEntries(
      env.claim.children
        .filter((c): c is typeof c & { node: 'leaf' } => c.node === 'leaf')
        .map((c) => [c.name, String(c.value)])
        .concat([[leafName, JSON.stringify(proof)]]),
    ),
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

describe('evaluateJoinPolicy — requires_handshake', () => {
  it('rejects when no handshake_proof leaf is attached to the envelope', () => {
    const joiner = Wallet.generate();
    const env = selfMembershipFrom(joiner);
    const result = evaluateJoinPolicy(
      { kind: 'requires_handshake', with_any_of: ['anchor-pubkey'] },
      env,
      [],
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/no handshake_proof leaf/);
  });

  it('accepts when the proof discloses a co-signed handshake with one of the anchor pubkeys', () => {
    const joiner = Wallet.generate();
    const anchor = Wallet.generate();
    signedIdentity(joiner, 'Joiner');
    signedIdentity(anchor, 'Anchor');
    const handshake = handshakeProofBetween(joiner, anchor);
    const proof = disclosureProof(handshake, 'verification');
    const env = withProofLeaf(selfMembershipFrom(joiner), 'handshake_proof', proof);
    const result = evaluateJoinPolicy(
      { kind: 'requires_handshake', with_any_of: [anchor.identity] },
      env,
      [],
    );
    expect(result.accepted).toBe(true);
    expect(result.reason).toMatch(/valid co-signed handshake/);
  });

  it('rejects when the disclosed handshake does not include any anchor on the with_any_of list', () => {
    const joiner = Wallet.generate();
    const other = Wallet.generate();
    signedIdentity(joiner, 'Joiner');
    signedIdentity(other, 'Other');
    const handshake = handshakeProofBetween(joiner, other);
    const proof = disclosureProof(handshake, 'verification');
    const env = withProofLeaf(selfMembershipFrom(joiner), 'handshake_proof', proof);
    const result = evaluateJoinPolicy(
      { kind: 'requires_handshake', with_any_of: ['some-other-anchor-pubkey'] },
      env,
      [],
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/with_any_of/);
  });

  it('rejects when the disclosed proof comes from a credential envelope, not a relationship', () => {
    const joiner = Wallet.generate();
    const issuer = Wallet.generate();
    const credential = credentialProofFor(joiner, issuer, 'voter_id');
    const proof = disclosureProof(credential, 'credential_type');
    const env = withProofLeaf(selfMembershipFrom(joiner), 'handshake_proof', proof);
    const result = evaluateJoinPolicy(
      { kind: 'requires_handshake', with_any_of: [issuer.identity] },
      env,
      [],
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/not a relationship/);
  });

  it('rejects when the handshake_proof leaf is structurally malformed JSON', () => {
    const joiner = Wallet.generate();
    const env = credentialAttestation({
      subject: joiner.identity,
      tier: 'notable',
      fields: {
        credential_type: 'self_membership',
        org_id: 'org-pubkey-hex',
        org_name: 'Org',
        joined_at: '2026-05-26T00:00:00.000Z',
        requested_at: '2026-05-26T00:00:00.000Z',
        handshake_proof: 'not-valid-json',
      },
    });
    const result = evaluateJoinPolicy(
      { kind: 'requires_handshake', with_any_of: ['anchor'] },
      env,
      [],
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/no handshake_proof leaf/);
  });
});

describe('evaluateJoinPolicy — requires_credential', () => {
  it('rejects when no credential_proof leaf is attached', () => {
    const joiner = Wallet.generate();
    const env = selfMembershipFrom(joiner);
    const result = evaluateJoinPolicy(
      { kind: 'requires_credential', credential_type: 'voter_id' },
      env,
      [],
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/no credential_proof leaf/);
  });

  it('accepts when the disclosed credential matches the policy credential_type', () => {
    const joiner = Wallet.generate();
    const issuer = Wallet.generate();
    const credential = credentialProofFor(joiner, issuer, 'voter_id');
    const proof = disclosureProof(credential, 'credential_type');
    const env = withProofLeaf(selfMembershipFrom(joiner), 'credential_proof', proof);
    const result = evaluateJoinPolicy(
      { kind: 'requires_credential', credential_type: 'voter_id' },
      env,
      [],
    );
    expect(result.accepted).toBe(true);
    expect(result.reason).toMatch(/voter_id/);
  });

  it('rejects when the disclosed credential_type does not match the policy', () => {
    const joiner = Wallet.generate();
    const issuer = Wallet.generate();
    const credential = credentialProofFor(joiner, issuer, 'membership');
    const proof = disclosureProof(credential, 'credential_type');
    const env = withProofLeaf(selfMembershipFrom(joiner), 'credential_proof', proof);
    const result = evaluateJoinPolicy(
      { kind: 'requires_credential', credential_type: 'voter_id' },
      env,
      [],
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/policy requires voter_id/);
  });

  it('rejects when the credential subject is not the joiner', () => {
    const joiner = Wallet.generate();
    const someoneElse = Wallet.generate();
    const issuer = Wallet.generate();
    const credential = credentialProofFor(someoneElse, issuer, 'voter_id');
    const proof = disclosureProof(credential, 'credential_type');
    const env = withProofLeaf(selfMembershipFrom(joiner), 'credential_proof', proof);
    const result = evaluateJoinPolicy(
      { kind: 'requires_credential', credential_type: 'voter_id' },
      env,
      [],
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/subject is not the joiner/);
  });

  it('accepts when the policy names an issuer and the credential signature comes from that issuer', () => {
    const joiner = Wallet.generate();
    const issuer = Wallet.generate();
    const credential = credentialProofFor(joiner, issuer, 'voter_id');
    const proof = disclosureProof(credential, 'credential_type');
    const env = withProofLeaf(selfMembershipFrom(joiner), 'credential_proof', proof);
    const result = evaluateJoinPolicy(
      {
        kind: 'requires_credential',
        credential_type: 'voter_id',
        issuer: issuer.identity,
      },
      env,
      [],
    );
    expect(result.accepted).toBe(true);
    expect(result.reason).toMatch(/from the named issuer/);
  });

  it('rejects when the policy names an issuer but a different signer produced the credential', () => {
    const joiner = Wallet.generate();
    const actualIssuer = Wallet.generate();
    const expectedIssuer = Wallet.generate();
    const credential = credentialProofFor(joiner, actualIssuer, 'voter_id');
    const proof = disclosureProof(credential, 'credential_type');
    const env = withProofLeaf(selfMembershipFrom(joiner), 'credential_proof', proof);
    const result = evaluateJoinPolicy(
      {
        kind: 'requires_credential',
        credential_type: 'voter_id',
        issuer: expectedIssuer.identity,
      },
      env,
      [],
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/no valid signature from the policy's named issuer/);
  });
});

describe('evaluateJoinPolicy — requires_vouch', () => {
  it('rejects when no known members are in holdings (verifier-side path)', () => {
    const joiner = Wallet.generate();
    const env = selfMembershipFrom(joiner);
    const result = evaluateJoinPolicy(
      { kind: 'requires_vouch', from_any_member_count: 2 },
      env,
      [],
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/no known members/);
  });

  it('accepts when enough known-member cosigners ride the self-membership signatures', () => {
    const joiner = Wallet.generate();
    const orgWallet = Wallet.generate();
    const memberA = Wallet.generate();
    const memberB = Wallet.generate();
    // Org's holdings include two accepted self-memberships from memberA + memberB.
    const aSelf = memberA.sign(selfMembershipFrom(memberA, orgWallet.identity));
    const bSelf = memberB.sign(selfMembershipFrom(memberB, orgWallet.identity));
    // Joiner's self-membership cosigned by both members.
    const draft = selfMembershipFrom(joiner, orgWallet.identity);
    const dual = memberA.sign(joiner.sign(draft));
    const fullySigned = memberB.sign(dual);
    const result = evaluateJoinPolicy(
      { kind: 'requires_vouch', from_any_member_count: 2 },
      fullySigned,
      [aSelf, bSelf],
    );
    expect(result.accepted).toBe(true);
    expect(result.reason).toMatch(/2 known-member voucher/);
  });

  it('rejects when fewer cosigners than the required vouch count are known members', () => {
    const joiner = Wallet.generate();
    const orgWallet = Wallet.generate();
    const memberA = Wallet.generate();
    const stranger = Wallet.generate();
    const aSelf = memberA.sign(selfMembershipFrom(memberA, orgWallet.identity));
    const draft = selfMembershipFrom(joiner, orgWallet.identity);
    const dual = memberA.sign(joiner.sign(draft));
    const fullySigned = stranger.sign(dual); // stranger is NOT a known member
    const result = evaluateJoinPolicy(
      { kind: 'requires_vouch', from_any_member_count: 2 },
      fullySigned,
      [aSelf],
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/1 known-member voucher signature\(s\).*need 2/);
  });

  it('also counts org-issued membership recipients as known members for vouch purposes', () => {
    const joiner = Wallet.generate();
    const orgWallet = Wallet.generate();
    const issuedMember = Wallet.generate();
    // Holdings include a membership the org issued to issuedMember.
    const orgMembership = orgWallet.sign(
      credentialAttestation({
        subject: issuedMember.identity,
        tier: 'notable',
        fields: {
          credential_type: 'membership',
          org_id: orgWallet.identity,
          org_name: 'Org',
          member_id: issuedMember.identity,
          member_name: 'Member',
          issued_at: '2026-05-26T00:00:00.000Z',
        },
      }),
    );
    const draft = selfMembershipFrom(joiner, orgWallet.identity);
    const fullySigned = issuedMember.sign(joiner.sign(draft));
    const result = evaluateJoinPolicy(
      { kind: 'requires_vouch', from_any_member_count: 1 },
      fullySigned,
      [orgMembership],
    );
    expect(result.accepted).toBe(true);
    expect(result.reason).toMatch(/1 known-member voucher/);
  });
});
