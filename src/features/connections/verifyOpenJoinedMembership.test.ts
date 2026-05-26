import { describe, expect, it } from 'vitest';
import { Wallet, credentialAttestation, identityAttestation } from 'tapit-attest';
import type { Attestation } from 'tapit-attest';

import { buildSelfMembershipDraft } from './createMembership.ts';
import { buildOpenMemberRosterDraft } from './openMemberRoster.ts';
import {
  buildOrgSelfDeclarationDraft,
} from './createOrganization.ts';
import { verifyOpenJoinedMembership } from './verifyOpenJoinedMembership.ts';
import type { AuthRule } from '../governance/authRule.ts';

// Coverage for the Phase 8 Phase E4 cut 1 open-joined-membership
// verifier under the Option 3 hybrid substrate. The verifier composes
// three already-shipped pieces: findAuthRule + isJoinRule from the
// Phase E1 substrate, evaluateJoinPolicy from Phase E3 cut 1, and
// isOpenMemberRoster + readOpenMemberRoster from Phase E3 cut 2. Tests
// confirm: (a) structural gates reject malformed inputs before either
// proof path runs; (b) the roster path accepts a joiner whose
// self-membership envelopeId appears in a signed org roster; (c) the
// auth-tree path accepts the list-checking policies (open / allow /
// deny) per the evaluator's contract; (d) the auth-tree path defers
// the proof-required policies (handshake / credential / vouch) to
// Phase E4 cut 2 with reason names preserved; (e) hybrid precedence
// works — roster path checked first, auth-tree path is the fallback,
// both rejecting yields a consolidated reason.

function signedIdentity(w: Wallet, name: string): Attestation {
  return w.sign(
    identityAttestation({
      subject: w.identity,
      tier: 'notable',
      fields: { display_name: name },
    }),
  );
}

function signedSelfMembership(joiner: Wallet, orgId: string, orgName: string): Attestation {
  const joinerIdent = signedIdentity(joiner, 'Joiner');
  return joiner.sign(buildSelfMembershipDraft(joinerIdent, orgId, orgName));
}

function signedOrgSelfDecl(
  org: Wallet,
  authRules: readonly AuthRule[],
  orgName = 'American Legion',
): Attestation {
  return org.sign(buildOrgSelfDeclarationDraft(org.identity, orgName, authRules));
}

function signedRoster(
  org: Wallet,
  selfMemberships: readonly Attestation[],
  publishedAt = '2026-05-26T00:00:00.000Z',
): Attestation {
  return org.sign(buildOpenMemberRosterDraft(org.identity, selfMemberships, publishedAt));
}

describe('verifyOpenJoinedMembership — structural gates', () => {
  it('rejects a non-self-membership envelope', () => {
    const org = Wallet.generate();
    const joiner = Wallet.generate();
    const orgDecl = signedOrgSelfDecl(org, [{ action: 'join', policy: { kind: 'open' } }]);
    // Use a handshake-shaped attestation instead of a self-membership.
    const wrongShape = credentialAttestation({
      subject: joiner.identity,
      tier: 'notable',
      fields: { credential_type: 'membership', org_id: org.identity, org_name: 'X' },
    });
    const result = verifyOpenJoinedMembership(joiner.sign(wrongShape), orgDecl);
    expect(result.valid).toBe(false);
    expect(result.proofPath).toBe('none');
    expect(result.reason).toMatch(/not a self-membership/);
  });

  it('rejects when orgSelfDecl is not an organization self-declaration', () => {
    const org = Wallet.generate();
    const joiner = Wallet.generate();
    const fakeOrgDecl = signedIdentity(org, 'Not an org');
    const env = signedSelfMembership(joiner, org.identity, 'X');
    const result = verifyOpenJoinedMembership(env, fakeOrgDecl);
    expect(result.valid).toBe(false);
    expect(result.proofPath).toBe('none');
    expect(result.reason).toMatch(/organization self-declaration/);
  });

  it("rejects when the envelope's org_id leaf does not match orgSelfDecl.subject", () => {
    const orgA = Wallet.generate();
    const orgB = Wallet.generate();
    const joiner = Wallet.generate();
    const orgADecl = signedOrgSelfDecl(orgA, [{ action: 'join', policy: { kind: 'open' } }]);
    // Self-membership names orgB as the org but verifier is given orgA's decl.
    const env = signedSelfMembership(joiner, orgB.identity, 'B');
    const result = verifyOpenJoinedMembership(env, orgADecl);
    expect(result.valid).toBe(false);
    expect(result.proofPath).toBe('none');
    expect(result.reason).toMatch(/org_id/);
  });

  it('rejects when the self-membership is not signed by its subject', () => {
    const org = Wallet.generate();
    const joiner = Wallet.generate();
    const orgDecl = signedOrgSelfDecl(org, [{ action: 'join', policy: { kind: 'open' } }]);
    // Build but do not sign the self-membership.
    const joinerIdent = signedIdentity(joiner, 'Joiner');
    const unsigned = buildSelfMembershipDraft(joinerIdent, org.identity, 'Org');
    const result = verifyOpenJoinedMembership(unsigned, orgDecl);
    expect(result.valid).toBe(false);
    expect(result.proofPath).toBe('none');
    expect(result.reason).toMatch(/signed by its subject/);
  });
});

describe('verifyOpenJoinedMembership — auth-tree path (Option 2)', () => {
  it('accepts under an open join policy', () => {
    const org = Wallet.generate();
    const joiner = Wallet.generate();
    const orgDecl = signedOrgSelfDecl(org, [{ action: 'join', policy: { kind: 'open' } }]);
    const env = signedSelfMembership(joiner, org.identity, 'Org');
    const result = verifyOpenJoinedMembership(env, orgDecl);
    expect(result.valid).toBe(true);
    expect(result.proofPath).toBe('auth_tree');
    expect(result.reason).toMatch(/open/);
  });

  it('accepts under an allow_list when the joiner is listed', () => {
    const org = Wallet.generate();
    const joiner = Wallet.generate();
    const orgDecl = signedOrgSelfDecl(org, [
      { action: 'join', policy: { kind: 'allow_list', pubkeys: [joiner.identity] } },
    ]);
    const env = signedSelfMembership(joiner, org.identity, 'Org');
    const result = verifyOpenJoinedMembership(env, orgDecl);
    expect(result.valid).toBe(true);
    expect(result.proofPath).toBe('auth_tree');
    expect(result.reason).toMatch(/allow-list/);
  });

  it('rejects under an allow_list when the joiner is absent', () => {
    const org = Wallet.generate();
    const joiner = Wallet.generate();
    const orgDecl = signedOrgSelfDecl(org, [
      { action: 'join', policy: { kind: 'allow_list', pubkeys: ['unrelated-pubkey'] } },
    ]);
    const env = signedSelfMembership(joiner, org.identity, 'Org');
    const result = verifyOpenJoinedMembership(env, orgDecl);
    expect(result.valid).toBe(false);
    expect(result.proofPath).toBe('none');
    expect(result.reason).toMatch(/allow-list/);
  });

  it('accepts under a deny_list when the joiner is absent', () => {
    const org = Wallet.generate();
    const joiner = Wallet.generate();
    const orgDecl = signedOrgSelfDecl(org, [
      { action: 'join', policy: { kind: 'deny_list', pubkeys: ['banned-pubkey'] } },
    ]);
    const env = signedSelfMembership(joiner, org.identity, 'Org');
    const result = verifyOpenJoinedMembership(env, orgDecl);
    expect(result.valid).toBe(true);
    expect(result.proofPath).toBe('auth_tree');
    expect(result.reason).toMatch(/deny-list/);
  });

  it('rejects under a deny_list when the joiner is listed', () => {
    const org = Wallet.generate();
    const joiner = Wallet.generate();
    const orgDecl = signedOrgSelfDecl(org, [
      { action: 'join', policy: { kind: 'deny_list', pubkeys: [joiner.identity] } },
    ]);
    const env = signedSelfMembership(joiner, org.identity, 'Org');
    const result = verifyOpenJoinedMembership(env, orgDecl);
    expect(result.valid).toBe(false);
    expect(result.proofPath).toBe('none');
    expect(result.reason).toMatch(/deny-list/);
  });

  it('rejects requires_handshake with reason naming Phase E4', () => {
    const org = Wallet.generate();
    const joiner = Wallet.generate();
    const orgDecl = signedOrgSelfDecl(org, [
      { action: 'join', policy: { kind: 'requires_handshake', with_any_of: ['some-anchor'] } },
    ]);
    const env = signedSelfMembership(joiner, org.identity, 'Org');
    const result = verifyOpenJoinedMembership(env, orgDecl);
    expect(result.valid).toBe(false);
    expect(result.proofPath).toBe('none');
    expect(result.reason).toMatch(/Phase E4/);
  });

  it('rejects requires_credential with reason naming Phase E4', () => {
    const org = Wallet.generate();
    const joiner = Wallet.generate();
    const orgDecl = signedOrgSelfDecl(org, [
      {
        action: 'join',
        policy: { kind: 'requires_credential', credential_type: 'voter_id' },
      },
    ]);
    const env = signedSelfMembership(joiner, org.identity, 'Org');
    const result = verifyOpenJoinedMembership(env, orgDecl);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Phase E4/);
  });

  it('rejects requires_vouch with reason naming Phase E4', () => {
    const org = Wallet.generate();
    const joiner = Wallet.generate();
    const orgDecl = signedOrgSelfDecl(org, [
      { action: 'join', policy: { kind: 'requires_vouch', from_any_member_count: 2 } },
    ]);
    const env = signedSelfMembership(joiner, org.identity, 'Org');
    const result = verifyOpenJoinedMembership(env, orgDecl);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Phase E4/);
  });

  it('rejects when the org has no join rule in its auth tree', () => {
    const org = Wallet.generate();
    const joiner = Wallet.generate();
    // No join rule — only the default routine_issuance.
    const orgDecl = signedOrgSelfDecl(org, [
      { action: 'routine_issuance', threshold: 1, eligible: [org.identity] },
    ]);
    const env = signedSelfMembership(joiner, org.identity, 'Org');
    const result = verifyOpenJoinedMembership(env, orgDecl);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/has not declared a join policy/);
  });
});

describe('verifyOpenJoinedMembership — roster path (Option 1)', () => {
  it('accepts when the joiner is named on a signed org roster', () => {
    const org = Wallet.generate();
    const joiner = Wallet.generate();
    // Lock down the auth-tree path by giving the org a closed allow_list
    // that does NOT contain the joiner. The roster must do all the work.
    const orgDecl = signedOrgSelfDecl(org, [
      { action: 'join', policy: { kind: 'allow_list', pubkeys: ['unrelated'] } },
    ]);
    const env = signedSelfMembership(joiner, org.identity, 'Org');
    const roster = signedRoster(org, [env]);
    const result = verifyOpenJoinedMembership(env, orgDecl, roster);
    expect(result.valid).toBe(true);
    expect(result.proofPath).toBe('roster');
    expect(result.reason).toMatch(/roster/i);
  });

  it('falls through to auth-tree path when the roster does not list the joiner', () => {
    const org = Wallet.generate();
    const joiner = Wallet.generate();
    const otherJoiner = Wallet.generate();
    const orgDecl = signedOrgSelfDecl(org, [{ action: 'join', policy: { kind: 'open' } }]);
    const otherEnv = signedSelfMembership(otherJoiner, org.identity, 'Org');
    const ourEnv = signedSelfMembership(joiner, org.identity, 'Org');
    const roster = signedRoster(org, [otherEnv]); // names otherJoiner only
    const result = verifyOpenJoinedMembership(ourEnv, orgDecl, roster);
    // Open policy accepts on the fallback.
    expect(result.valid).toBe(true);
    expect(result.proofPath).toBe('auth_tree');
  });

  it('ignores a roster bound to a different org and falls through', () => {
    const orgA = Wallet.generate();
    const orgB = Wallet.generate();
    const joiner = Wallet.generate();
    // orgA accepts joiner; roster published by orgB lists the same env.
    const orgADecl = signedOrgSelfDecl(orgA, [{ action: 'join', policy: { kind: 'open' } }]);
    const env = signedSelfMembership(joiner, orgA.identity, 'A');
    const rosterFromB = signedRoster(orgB, [env]);
    const result = verifyOpenJoinedMembership(env, orgADecl, rosterFromB);
    // Roster path rejected (wrong org); auth-tree path accepts via open.
    expect(result.valid).toBe(true);
    expect(result.proofPath).toBe('auth_tree');
  });

  it('rejects through both paths when roster absent and join rule absent', () => {
    const org = Wallet.generate();
    const joiner = Wallet.generate();
    const orgDecl = signedOrgSelfDecl(org, [
      { action: 'routine_issuance', threshold: 1, eligible: [org.identity] },
    ]);
    const env = signedSelfMembership(joiner, org.identity, 'Org');
    const result = verifyOpenJoinedMembership(env, orgDecl, null);
    expect(result.valid).toBe(false);
    expect(result.proofPath).toBe('none');
    expect(result.reason).toMatch(/no current roster/);
    expect(result.reason).toMatch(/has not declared a join policy/);
  });

  it('accepts even when the auth-tree path rejects but the roster validates (hybrid override)', () => {
    const org = Wallet.generate();
    const joiner = Wallet.generate();
    // Closed allow_list rejects the joiner under the auth-tree path.
    const orgDecl = signedOrgSelfDecl(org, [
      { action: 'join', policy: { kind: 'deny_list', pubkeys: [joiner.identity] } },
    ]);
    const env = signedSelfMembership(joiner, org.identity, 'Org');
    const roster = signedRoster(org, [env]);
    const result = verifyOpenJoinedMembership(env, orgDecl, roster);
    // Hybrid: roster path wins because it's checked first AND it validates.
    expect(result.valid).toBe(true);
    expect(result.proofPath).toBe('roster');
  });
});

describe('verifyOpenJoinedMembership — case insensitivity', () => {
  it('accepts when the envelope org_id is mixed-case and orgSelfDecl.subject is lowercase', () => {
    const org = Wallet.generate();
    const joiner = Wallet.generate();
    const orgDecl = signedOrgSelfDecl(org, [{ action: 'join', policy: { kind: 'open' } }]);
    // Hand-build a self-membership with an UPPER-CASE org_id leaf.
    const joinerIdent = signedIdentity(joiner, 'Joiner');
    const draft = buildSelfMembershipDraft(joinerIdent, org.identity.toUpperCase(), 'Org');
    const env = joiner.sign(draft);
    const result = verifyOpenJoinedMembership(env, orgDecl);
    expect(result.valid).toBe(true);
    expect(result.proofPath).toBe('auth_tree');
  });
});
