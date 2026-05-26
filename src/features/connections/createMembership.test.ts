import { describe, expect, it } from 'vitest';
import { Wallet, identityAttestation, envelopeId } from 'tapit-attest';
import type { Attestation } from 'tapit-attest';

import {
  buildOrgSelfDeclarationDraft,
  verifyOrgAuthorization,
} from './createOrganization.ts';
import {
  buildMembershipDraft,
  buildSelfMembershipDraft,
  isMembership,
  isSelfMembership,
  readMembership,
  readSelfMembership,
  receiveSelfMembership,
} from './createMembership.ts';
import {
  buildAuthorizedByPayload,
  decodeAuthorizedBy,
  type AuthRule,
} from '../governance/authRule.ts';
import { leafValue, buildHandshakeDraft } from './createHandshake.ts';

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

// ---------- Phase E2 — joiner-side self-membership ----------

describe('buildSelfMembershipDraft', () => {
  it('produces a credential-kind attestation subject-bound to the joiner', () => {
    const joiner = Wallet.generate();
    const joinerIdent = signedIdentity(joiner, 'Sam');

    const draft = buildSelfMembershipDraft(
      joinerIdent,
      'org-pubkey-hex',
      'American Legion',
    );

    expect(draft.kind).toBe('credential');
    expect(draft.subject).toBe(joiner.identity);
    expect(leafValue(draft, 'credential_type')).toBe('self_membership');
    expect(leafValue(draft, 'org_id')).toBe('org-pubkey-hex');
    expect(leafValue(draft, 'org_name')).toBe('American Legion');
  });

  it('writes both joined_at and requested_at as ISO timestamps at draft time', () => {
    const joiner = Wallet.generate();
    const joinerIdent = signedIdentity(joiner, 'Sam');

    const before = Date.now();
    const draft = buildSelfMembershipDraft(joinerIdent, 'org-id', 'Org');
    const after = Date.now();

    const joinedAt = Date.parse(leafValue(draft, 'joined_at'));
    const requestedAt = Date.parse(leafValue(draft, 'requested_at'));
    expect(Number.isFinite(joinedAt)).toBe(true);
    expect(Number.isFinite(requestedAt)).toBe(true);
    expect(joinedAt).toBeGreaterThanOrEqual(before);
    expect(joinedAt).toBeLessThanOrEqual(after);
    // Both fields are set in a single `new Date().toISOString()` call,
    // so they must be byte-identical for an envelope built in one shot.
    expect(leafValue(draft, 'joined_at')).toBe(leafValue(draft, 'requested_at'));
  });

  it('produces an envelope the joiner can sign without throwing', () => {
    const joiner = Wallet.generate();
    const joinerIdent = signedIdentity(joiner, 'Sam');

    const draft = buildSelfMembershipDraft(joinerIdent, 'org-id', 'Org');
    const signed = joiner.sign(draft);

    expect(signed.signatures.length).toBe(1);
    expect(signed.signatures[0]!.signer).toBe(joiner.identity);
    // envelopeId is stable for downstream anchoring; assert it computes.
    expect(envelopeId(signed)).toMatch(/^[0-9a-f]+$/);
  });
});

describe('isSelfMembership', () => {
  it('returns true for a self-membership credential', () => {
    const joiner = Wallet.generate();
    const joinerIdent = signedIdentity(joiner, 'Sam');
    const draft = buildSelfMembershipDraft(joinerIdent, 'org-id', 'Org');
    expect(isSelfMembership(draft)).toBe(true);
    expect(isSelfMembership(joiner.sign(draft))).toBe(true);
  });

  it('returns false for an org-issued membership (different credential_type)', () => {
    const org = Wallet.generate();
    const member = Wallet.generate();
    const orgIdent = signedIdentity(org, 'Org');
    const memberIdent = signedIdentity(member, 'Pat');
    const draft = buildMembershipDraft(orgIdent, memberIdent);
    expect(isSelfMembership(draft)).toBe(false);
    // The complementary predicate stays true on the org-issued shape —
    // the two predicates are mutually exclusive by credential_type.
    expect(isMembership(draft)).toBe(true);
  });

  it('returns false for a handshake (different attestation kind)', () => {
    const a = Wallet.generate();
    const b = Wallet.generate();
    const aIdent = signedIdentity(a, 'A');
    const bIdent = signedIdentity(b, 'B');
    const draft = buildHandshakeDraft(aIdent, bIdent);
    expect(isSelfMembership(draft)).toBe(false);
  });
});

describe('readSelfMembership', () => {
  it('round-trips every signed leaf through the view', () => {
    const joiner = Wallet.generate();
    const joinerIdent = signedIdentity(joiner, 'Sam');
    const draft = buildSelfMembershipDraft(
      joinerIdent,
      'org-pubkey-hex',
      'American Legion',
    );
    const signed = joiner.sign(draft);

    const view = readSelfMembership(signed);
    expect(view.joinerId).toBe(joiner.identity);
    expect(view.orgId).toBe('org-pubkey-hex');
    expect(view.orgName).toBe('American Legion');
    expect(view.joinedAt).toBe(leafValue(signed, 'joined_at'));
    expect(view.requestedAt).toBe(leafValue(signed, 'requested_at'));
  });
});

describe('receiveSelfMembership acceptor — Phase E3 cut 1 gates', () => {
  // Three structural gates: envelope shape, org has a join rule,
  // join-policy accepts. Storage round-trip belongs to a later
  // integration test (anchorQueue.upsert hits IndexedDB which jsdom
  // does not ship); here we cover the synchronous gates plus the
  // accept path's lookup contract. The accept path itself short-
  // circuits before holdAndAnchor by stubbing the rejected verdict
  // through a deny_list policy that names the joiner — that gate
  // throws BEFORE wallet.hold runs, so we can assert the throw
  // without exercising the IndexedDB-bound code path.

  it('throws when the envelope is not a self-membership', async () => {
    const org = Wallet.generate();
    const member = Wallet.generate();
    const orgHost = Wallet.generate();
    const orgIdent = signedIdentity(org, 'Org');
    const memberIdent = signedIdentity(member, 'Pat');
    const orgMembership = org.sign(buildMembershipDraft(orgIdent, memberIdent));
    const orgDecl = declareOrg(org, 'Org', [{ action: 'join', policy: { kind: 'open' } }]);

    await expect(
      receiveSelfMembership({
        wallet: orgHost,
        ownerId: orgHost.identity,
        anchorWorker: null,
        attestation: orgMembership,
        orgSelfDecl: orgDecl,
        holdings: [],
      }),
    ).rejects.toThrow(/not a self-membership/);
  });

  it('throws when the org self-declaration has no join rule', async () => {
    const joiner = Wallet.generate();
    const org = Wallet.generate();
    const orgHost = Wallet.generate();
    const joinerIdent = signedIdentity(joiner, 'Sam');
    const signed = joiner.sign(buildSelfMembershipDraft(joinerIdent, org.identity, 'Org'));
    // Org declared without a join rule — pre-Phase-E1 shape via
    // defaultAuthRules (a single routine_issuance rule).
    const orgDecl = declareOrg(org, 'Org', [
      { action: 'routine_issuance', threshold: 1, eligible: [org.identity] },
    ]);

    await expect(
      receiveSelfMembership({
        wallet: orgHost,
        ownerId: orgHost.identity,
        anchorWorker: null,
        attestation: signed,
        orgSelfDecl: orgDecl,
        holdings: [],
      }),
    ).rejects.toThrow(/has not declared a join policy/);
  });

  it('throws when the join policy rejects the joiner — reason surfaces in error', async () => {
    const joiner = Wallet.generate();
    const org = Wallet.generate();
    const orgHost = Wallet.generate();
    const joinerIdent = signedIdentity(joiner, 'Sam');
    const signed = joiner.sign(buildSelfMembershipDraft(joinerIdent, org.identity, 'Org'));
    // deny_list policy that names this joiner — rejected before
    // the wallet.hold step the IndexedDB layer would otherwise
    // need to back.
    const orgDecl = declareOrg(org, 'Org', [
      { action: 'join', policy: { kind: 'deny_list', pubkeys: [joiner.identity] } },
    ]);

    await expect(
      receiveSelfMembership({
        wallet: orgHost,
        ownerId: orgHost.identity,
        anchorWorker: null,
        attestation: signed,
        orgSelfDecl: orgDecl,
        holdings: [],
      }),
    ).rejects.toThrow(/rejected by join policy.*deny-list/);
  });

  it('throws with Phase E4 reason when the policy requires joiner-side proof', async () => {
    const joiner = Wallet.generate();
    const org = Wallet.generate();
    const orgHost = Wallet.generate();
    const joinerIdent = signedIdentity(joiner, 'Sam');
    const signed = joiner.sign(buildSelfMembershipDraft(joinerIdent, org.identity, 'Org'));
    const orgDecl = declareOrg(org, 'Org', [
      {
        action: 'join',
        policy: { kind: 'requires_credential', credential_type: 'voter_id' },
      },
    ]);

    await expect(
      receiveSelfMembership({
        wallet: orgHost,
        ownerId: orgHost.identity,
        anchorWorker: null,
        attestation: signed,
        orgSelfDecl: orgDecl,
        holdings: [],
      }),
    ).rejects.toThrow(/Phase E4/);
  });

  it('produces a signed self-membership that any wallet can hold', async () => {
    // wallet.hold is the signature integrity check the acceptor
    // depends on internally; if hold rejects, receive would too.
    const joiner = Wallet.generate();
    const orgHost = Wallet.generate();
    const joinerIdent = signedIdentity(joiner, 'Sam');
    const signed = joiner.sign(
      buildSelfMembershipDraft(joinerIdent, 'org-id', 'Org'),
    );

    await orgHost.hold(signed);

    const holdings = await orgHost.holdings();
    const held = holdings.find((a) => envelopeId(a) === envelopeId(signed));
    expect(held).toBeDefined();
    expect(isSelfMembership(held!)).toBe(true);
  });
});
