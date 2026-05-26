import { describe, expect, it } from 'vitest';
import {
  Wallet,
  credentialAttestation,
  disclosureProof,
  envelopeId,
  identityAttestation,
  relationshipAttestation,
} from 'tapit-attest';
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
  readCredentialProof,
  readHandshakeProof,
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

describe('buildSelfMembershipDraft — Phase E4 cut 2 proof attachments', () => {
  it('bakes a handshake_proof leaf when supplied — readHandshakeProof round-trips the bundle', () => {
    const joiner = Wallet.generate();
    const anchor = Wallet.generate();
    const joinerIdent = signedIdentity(joiner, 'Sam');
    const handshake = anchor.sign(
      joiner.sign(
        relationshipAttestation({
          subject: joiner.identity,
          tier: 'notable',
          fields: {
            verification: 'in-person',
            handshake_at: '2026-05-26T00:00:00.000Z',
            initiator_id: joiner.identity,
            initiator_name: 'Sam',
            responder_id: anchor.identity,
            responder_name: 'Anchor',
          },
        }),
      ),
    );
    const proof = disclosureProof(handshake, 'verification');

    const draft = buildSelfMembershipDraft(joinerIdent, 'org-id', 'Org', {
      handshake_proof: proof,
    });
    const signed = joiner.sign(draft);

    expect(isSelfMembership(signed)).toBe(true);
    expect(leafValue(signed, 'handshake_proof').length).toBeGreaterThan(0);
    expect(leafValue(signed, 'credential_proof')).toBe('');

    const read = readHandshakeProof(signed);
    expect(read).not.toBeNull();
    expect(read?.meta.kind).toBe('relationship');
    expect(read?.leaf.name).toBe('verification');
    expect(read?.leaf.value).toBe('in-person');
  });

  it('bakes a credential_proof leaf when supplied — readCredentialProof round-trips the bundle', () => {
    const joiner = Wallet.generate();
    const issuer = Wallet.generate();
    const joinerIdent = signedIdentity(joiner, 'Sam');
    const credential = issuer.sign(
      credentialAttestation({
        subject: joiner.identity,
        tier: 'notable',
        fields: {
          credential_type: 'voter_id',
          issued_at: '2026-05-26T00:00:00.000Z',
        },
      }),
    );
    const proof = disclosureProof(credential, 'credential_type');

    const draft = buildSelfMembershipDraft(joinerIdent, 'org-id', 'Org', {
      credential_proof: proof,
    });
    const signed = joiner.sign(draft);

    expect(leafValue(signed, 'credential_proof').length).toBeGreaterThan(0);
    expect(leafValue(signed, 'handshake_proof')).toBe('');

    const read = readCredentialProof(signed);
    expect(read).not.toBeNull();
    expect(read?.meta.kind).toBe('credential');
    expect(read?.meta.subject).toBe(joiner.identity);
    expect(read?.leaf.value).toBe('voter_id');
  });

  it('preserves the back-compat five-field shape when no proofs are supplied', () => {
    const joiner = Wallet.generate();
    const joinerIdent = signedIdentity(joiner, 'Sam');
    const draft = buildSelfMembershipDraft(joinerIdent, 'org-id', 'Org');
    expect(leafValue(draft, 'handshake_proof')).toBe('');
    expect(leafValue(draft, 'credential_proof')).toBe('');
    // The five canonical leaves are still present and unchanged.
    expect(leafValue(draft, 'credential_type')).toBe('self_membership');
    expect(leafValue(draft, 'org_id')).toBe('org-id');
    expect(leafValue(draft, 'org_name')).toBe('Org');
    expect(leafValue(draft, 'joined_at').length).toBeGreaterThan(0);
    expect(leafValue(draft, 'requested_at').length).toBeGreaterThan(0);
  });

  it('readHandshakeProof returns null when the envelope has no leaf', () => {
    const joiner = Wallet.generate();
    const joinerIdent = signedIdentity(joiner, 'Sam');
    const draft = buildSelfMembershipDraft(joinerIdent, 'org-id', 'Org');
    expect(readHandshakeProof(draft)).toBeNull();
    expect(readCredentialProof(draft)).toBeNull();
  });

  it('readHandshakeProof returns null when the leaf is malformed JSON', () => {
    // Construct a self-membership manually with a junk handshake_proof leaf —
    // the reader must reject without throwing.
    const joiner = Wallet.generate();
    const draft = credentialAttestation({
      subject: joiner.identity,
      tier: 'notable',
      fields: {
        credential_type: 'self_membership',
        org_id: 'org-id',
        org_name: 'Org',
        joined_at: '2026-05-26T00:00:00.000Z',
        requested_at: '2026-05-26T00:00:00.000Z',
        handshake_proof: 'not-json',
      },
    });
    expect(readHandshakeProof(draft)).toBeNull();
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

  it('throws when the policy requires joiner-side proof and the envelope has none attached', async () => {
    // Phase E4 cut 2 flipped this gate from "deferred to Phase E4" to a
    // concrete "no credential_proof leaf attached" reject — the policy
    // CAN be evaluated now, but only when the joiner baked the proof
    // leaf via buildSelfMembershipDraft's optional proofs parameter.
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
    ).rejects.toThrow(/no credential_proof leaf/);
  });

  it('accepts a self-membership through requires_credential when a valid credential_proof rides along', async () => {
    // Phase E4 cut 2 happy-path through the org-side gate: joiner
    // attaches a disclosureProof of the credential_type leaf of a
    // valid credential they hold, the policy verifies it
    // cryptographically, and the receive call gets past the gates
    // (failing only at the wallet.hold IndexedDB layer, which jsdom
    // doesn't back — so we assert on the IndexedDB-shaped throw, not
    // the gate-shaped throw, as proof the gates accepted).
    const joiner = Wallet.generate();
    const org = Wallet.generate();
    const issuer = Wallet.generate();
    const orgHost = Wallet.generate();
    const joinerIdent = signedIdentity(joiner, 'Sam');
    const credential = issuer.sign(
      credentialAttestation({
        subject: joiner.identity,
        tier: 'notable',
        fields: {
          credential_type: 'voter_id',
          issued_at: '2026-05-26T00:00:00.000Z',
        },
      }),
    );
    const proof = disclosureProof(credential, 'credential_type');
    const signed = joiner.sign(
      buildSelfMembershipDraft(joinerIdent, org.identity, 'Org', {
        credential_proof: proof,
      }),
    );
    const orgDecl = declareOrg(org, 'Org', [
      {
        action: 'join',
        policy: { kind: 'requires_credential', credential_type: 'voter_id' },
      },
    ]);

    // Past the gate, holdAndAnchor runs — the IndexedDB-bound path that
    // jsdom does not back. Either the IndexedDB layer throws or the
    // call resolves; what we're asserting is that the gate itself did
    // NOT reject. So we wrap and check the error if any is from past
    // the gates.
    let gateError: unknown = null;
    try {
      await receiveSelfMembership({
        wallet: orgHost,
        ownerId: orgHost.identity,
        anchorWorker: null,
        attestation: signed,
        orgSelfDecl: orgDecl,
        holdings: [],
      });
    } catch (err) {
      gateError = err;
    }
    // The gate-rejection error messages start with "self-membership
    // rejected by join policy" or "not a self-membership" or "has not
    // declared a join policy". The acceptance path past the gates
    // either succeeds or throws an IndexedDB-shaped error from
    // anchorQueue.upsert. Either way, no gate-shaped reject text.
    if (gateError) {
      const msg = gateError instanceof Error ? gateError.message : String(gateError);
      expect(msg).not.toMatch(/rejected by join policy/);
      expect(msg).not.toMatch(/has not declared a join policy/);
      expect(msg).not.toMatch(/not a self-membership/);
    }
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
