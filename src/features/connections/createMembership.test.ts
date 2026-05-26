import { describe, expect, it } from 'vitest';
import { Wallet, identityAttestation } from 'tapit-attest';
import type { Attestation } from 'tapit-attest';

import {
  buildOrgSelfDeclarationDraft,
  verifyOrgAuthorization,
} from './createOrganization.ts';
import { buildMembershipDraft, isMembership, readMembership } from './createMembership.ts';
import {
  buildAuthorizedByPayload,
  decodeAuthorizedBy,
  type AuthRule,
} from '../governance/authRule.ts';
import { leafValue } from './createHandshake.ts';

// Phase 8 Phase C cut 3 caller-wiring — round-trip coverage for the
// org-issuance flow MembershipModal now drives end-to-end. The
// production caller (MembershipModal.tsx) constructs the authorized_by
// payload from the operator's own org self-declaration and threads it
// through buildMembershipDraft; verifyOrgAuthorization on the signed
// envelope is the proof that the loop closes. These tests stand in
// for the modal: they exercise buildMembershipDraft directly with and
// without the optional authorizedBy parameter, sign with raw Wallet
// instances, and assert the verifier's verdict.

function signedIdentity(w: Wallet, name: string): Attestation {
  return w.sign(
    identityAttestation({
      subject: w.identity,
      tier: 'notable',
      fields: { display_name: name },
    }),
  );
}

function declareOrg(w: Wallet, name: string, rules: readonly AuthRule[]): Attestation {
  return w.sign(buildOrgSelfDeclarationDraft(w.identity, name, rules));
}

describe('buildMembershipDraft — back-compat', () => {
  it('produces a membership without an authorized_by leaf when authorizedBy is omitted', () => {
    const org = Wallet.generate();
    const member = Wallet.generate();
    const orgIdent = signedIdentity(org, 'Orchard Co-op');
    const memberIdent = signedIdentity(member, 'Pat');

    const draft = buildMembershipDraft(orgIdent, memberIdent);
    const signed = org.sign(draft);

    expect(isMembership(signed)).toBe(true);
    const view = readMembership(signed);
    expect(view.orgId).toBe(org.identity);
    expect(view.memberId).toBe(member.identity);
    // No authorized_by leaf; pre-Phase-8 envelope shape preserved.
    expect(leafValue(signed, 'authorized_by')).toBe('');
  });
});

describe('buildMembershipDraft — Phase 8 authorized_by leaf', () => {
  it('bakes the authorized_by leaf so the membership verifies under verifyOrgAuthorization', () => {
    const org = Wallet.generate();
    const member = Wallet.generate();
    const rules: AuthRule[] = [
      { action: 'routine_issuance', threshold: 1, eligible: [org.identity] },
    ];
    const orgDecl = declareOrg(org, 'Orchard Co-op', rules);
    const memberIdent = signedIdentity(member, 'Pat');
    const payload = buildAuthorizedByPayload(orgDecl, 'routine_issuance');
    expect(payload).not.toBeNull();

    const draft = buildMembershipDraft(orgDecl, memberIdent, payload!);
    const signed = org.sign(draft);

    // The encoded payload round-trips intact through the leaf.
    const decoded = decodeAuthorizedBy(leafValue(signed, 'authorized_by'));
    expect(decoded?.action).toBe('routine_issuance');
    expect(decoded?.org_identity).toBe(org.identity);

    const result = verifyOrgAuthorization(signed, [orgDecl]);
    expect(result.authorized).toBe(true);
    expect(result.eligibleCount).toBe(1);
    expect(result.thresholdRequired).toBe(1);
  });

  it('refuses verification when the rule needs two signatures but only the founder signed', () => {
    const org = Wallet.generate();
    const officerB = Wallet.generate();
    const member = Wallet.generate();
    const rules: AuthRule[] = [
      {
        action: 'routine_issuance',
        threshold: 2,
        eligible: [org.identity, officerB.identity],
      },
    ];
    const orgDecl = declareOrg(org, 'Orchard Co-op', rules);
    const memberIdent = signedIdentity(member, 'Pat');
    const payload = buildAuthorizedByPayload(orgDecl, 'routine_issuance');

    const draft = buildMembershipDraft(orgDecl, memberIdent, payload!);
    const signed = org.sign(draft);

    const result = verifyOrgAuthorization(signed, [orgDecl]);
    expect(result.authorized).toBe(false);
    expect(result.eligibleCount).toBe(1);
    expect(result.thresholdRequired).toBe(2);
    expect(result.reason).toContain('threshold not met');
  });

  it('passes verification once the second eligible signer co-signs the same envelope', () => {
    const org = Wallet.generate();
    const officerB = Wallet.generate();
    const member = Wallet.generate();
    const rules: AuthRule[] = [
      {
        action: 'routine_issuance',
        threshold: 2,
        eligible: [org.identity, officerB.identity],
      },
    ];
    const orgDecl = declareOrg(org, 'Orchard Co-op', rules);
    const memberIdent = signedIdentity(member, 'Pat');
    const payload = buildAuthorizedByPayload(orgDecl, 'routine_issuance');

    const draft = buildMembershipDraft(orgDecl, memberIdent, payload!);
    const signedOnce = org.sign(draft);
    const signedTwice = officerB.sign(signedOnce);

    const result = verifyOrgAuthorization(signedTwice, [orgDecl]);
    expect(result.authorized).toBe(true);
    expect(result.eligibleCount).toBe(2);
    expect(result.thresholdRequired).toBe(2);
  });
});
