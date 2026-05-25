import { describe, it, expect } from 'vitest';
import {
  Wallet,
  credentialAttestation,
  verifyDisclosureProof,
} from 'tapit-attest';
import type { Attestation } from 'tapit-attest';

import {
  buildAuthorizedByPayload,
  decodeAuthorizedBy,
  encodeAuthorizedBy,
  findAuthRule,
  listAuthRules,
  proveAuthorization,
  type AuthRule,
  type AuthorizedByPayload,
} from '../governance/authRule.ts';
import {
  buildOrgSelfDeclarationDraft,
  isOrganizationSelfDeclaration,
  selfDeclareOrganization,
  verifyOrgAuthorization,
} from './createOrganization.ts';

// Phase 8 Phase A — Tapscript-style authorization tree on the org
// self-declaration. These tests exercise the rule encode/decode
// round-trip and the cross-envelope disclosure-proof primitive used
// to authorize org-issued envelopes downstream (Phase B verifier
// will consume what proveAuthorization produces here).

function freshWallet(): Wallet {
  return Wallet.generate();
}

// Thin wrapper around the production buildOrgSelfDeclarationDraft pure
// builder + a sign call. Lets tests exercise the envelope shape and
// helpers without touching the async hold/anchor pipeline (jsdom has no
// IDB). Calling the production builder directly removes the encoding-
// duplication maintenance hazard flagged in Phase A's close-out
// opinions.
function inlineSelfDeclaration(
  wallet: Wallet,
  orgName: string,
  authRules: readonly AuthRule[],
  declaredAt?: string,
): Attestation {
  const draft = buildOrgSelfDeclarationDraft(
    wallet.identity,
    orgName,
    authRules,
    declaredAt,
  );
  return wallet.sign(draft);
}

// Build a synthetic org-issued credential envelope carrying an
// `authorized_by` leaf for the named action, signed by the supplied
// signer wallets. Subject is an arbitrary recipient pubkey so the
// envelope is shaped like a real org-issued credential without
// requiring an actual recipient wallet in the test.
function inlineAuthorizedCredential(
  orgSelfDecl: Attestation,
  action: string,
  signers: readonly Wallet[],
  subjectOverride?: string,
): Attestation {
  const payload = buildAuthorizedByPayload(orgSelfDecl, action);
  if (!payload) throw new Error(`no auth rule '${action}' in supplied self-declaration`);
  const draft = credentialAttestation({
    subject: subjectOverride ?? 'a'.repeat(64),
    tier: 'notable',
    fields: {
      credential_type: 'test_org_issued',
      issued_at: new Date().toISOString(),
      authorized_by: encodeAuthorizedBy(payload),
    },
  });
  let signed = draft;
  for (const w of signers) {
    signed = w.sign(signed);
  }
  return signed;
}

describe('selfDeclareOrganization — validation throws (Phase 8 Phase A)', () => {
  it('rejects duplicate action names', async () => {
    const w = freshWallet();
    const rules: AuthRule[] = [
      { action: 'routine_issuance', threshold: 1, eligible: [w.identity] },
      { action: 'routine_issuance', threshold: 2, eligible: [w.identity, 'a'.repeat(64)] },
    ];
    await expect(
      selfDeclareOrganization(w, 'owner-id', null, 'Org', rules),
    ).rejects.toThrow(/duplicate auth rule action/);
  });

  it('rejects threshold less than 1', async () => {
    const w = freshWallet();
    const rules: AuthRule[] = [
      { action: 'routine_issuance', threshold: 0, eligible: [w.identity] },
    ];
    await expect(
      selfDeclareOrganization(w, 'owner-id', null, 'Org', rules),
    ).rejects.toThrow(/threshold must be a positive integer/);
  });

  it('rejects non-integer threshold', async () => {
    const w = freshWallet();
    const rules: AuthRule[] = [
      { action: 'routine_issuance', threshold: 1.5, eligible: [w.identity, 'b'.repeat(64)] },
    ];
    await expect(
      selfDeclareOrganization(w, 'owner-id', null, 'Org', rules),
    ).rejects.toThrow(/threshold must be a positive integer/);
  });

  it('rejects threshold greater than eligible-set size', async () => {
    const w = freshWallet();
    const rules: AuthRule[] = [
      { action: 'expulsion', threshold: 3, eligible: [w.identity, 'c'.repeat(64)] },
    ];
    await expect(
      selfDeclareOrganization(w, 'owner-id', null, 'Org', rules),
    ).rejects.toThrow(/threshold 3 exceeds eligible count 2/);
  });

  it('rejects empty org name (existing behaviour preserved alongside auth additions)', async () => {
    const w = freshWallet();
    await expect(
      selfDeclareOrganization(w, 'owner-id', null, '   '),
    ).rejects.toThrow(/org name must not be empty/);
  });
});

describe('auth tree shape — inline signed envelopes', () => {
  it('default rule is single routine_issuance with founder eligible', () => {
    const w = freshWallet();
    const rules: AuthRule[] = [
      { action: 'routine_issuance', threshold: 1, eligible: [w.identity] },
    ];
    const decl = inlineSelfDeclaration(w, 'Acme', rules);
    expect(isOrganizationSelfDeclaration(decl)).toBe(true);
    const all = listAuthRules(decl);
    expect(all).toHaveLength(1);
    expect(all[0]?.action).toBe('routine_issuance');
    expect(all[0]?.threshold).toBe(1);
    expect(all[0]?.eligible).toEqual([w.identity.toLowerCase()]);
  });

  it('multi-rule declaration exposes every rule via listAuthRules', () => {
    const w = freshWallet();
    const officerB = 'b'.repeat(64);
    const officerC = 'c'.repeat(64);
    const rules: AuthRule[] = [
      { action: 'routine_issuance', threshold: 1, eligible: [w.identity, officerB, officerC] },
      { action: 'expulsion', threshold: 2, eligible: [w.identity, officerB, officerC] },
      { action: 'charter_amendment', threshold: 3, eligible: [w.identity, officerB, officerC] },
    ];
    const decl = inlineSelfDeclaration(w, 'Acme', rules);
    const all = listAuthRules(decl);
    expect(all.map((r) => r.action).sort()).toEqual([
      'charter_amendment',
      'expulsion',
      'routine_issuance',
    ]);
    const expulsion = all.find((r) => r.action === 'expulsion');
    expect(expulsion?.threshold).toBe(2);
    expect(expulsion?.eligible).toHaveLength(3);
  });

  it('findAuthRule returns null for an action not in the auth tree', () => {
    const w = freshWallet();
    const rules: AuthRule[] = [
      { action: 'routine_issuance', threshold: 1, eligible: [w.identity] },
    ];
    const decl = inlineSelfDeclaration(w, 'Acme', rules);
    expect(findAuthRule(decl, 'dissolution')).toBeNull();
  });

  it('findAuthRule returns null when there is no auth branch at all', () => {
    // Construct a pre-Phase-A-shaped self-declaration with no auth leaf.
    const w = freshWallet();
    const draft = credentialAttestation({
      subject: w.identity,
      tier: 'notable',
      fields: {
        credential_type: 'organization',
        org_name: 'Legacy Org',
        pubkey: w.identity,
        declared_at: new Date().toISOString(),
      },
    });
    const decl = w.sign(draft);
    expect(findAuthRule(decl, 'routine_issuance')).toBeNull();
    expect(listAuthRules(decl)).toEqual([]);
  });

  it('eligible list is normalized (sorted + lowercased) inside the envelope leaf', () => {
    const w = freshWallet();
    // Provide eligible pubkeys in non-sorted, mixed-case order; the
    // canonical encoding inside the leaf must collapse this so two
    // semantically-identical rosters always produce the same Merkle hash.
    const officerB = 'B'.repeat(64);
    const officerC = 'c'.repeat(64);
    const rules: AuthRule[] = [
      { action: 'routine_issuance', threshold: 2, eligible: [officerC, w.identity, officerB] },
    ];
    const decl = inlineSelfDeclaration(w, 'Acme', rules);
    const found = findAuthRule(decl, 'routine_issuance');
    expect(found).not.toBeNull();
    const eligible = found?.rule.eligible ?? [];
    // After decode, eligible is in sorted-lowercased order.
    expect([...eligible]).toEqual([...eligible].sort());
    expect(eligible.every((e) => e === e.toLowerCase())).toBe(true);
  });
});

describe('proveAuthorization — cross-envelope disclosure proof', () => {
  it('produces a disclosure-proof bundle that verifies round-trip', () => {
    const w = freshWallet();
    const officerB = 'b'.repeat(64);
    const officerC = 'c'.repeat(64);
    const rules: AuthRule[] = [
      { action: 'routine_issuance', threshold: 1, eligible: [w.identity] },
      { action: 'expulsion', threshold: 2, eligible: [w.identity, officerB, officerC] },
    ];
    const decl = inlineSelfDeclaration(w, 'Acme', rules);
    const proof = proveAuthorization(decl, 'expulsion');
    expect(proof).not.toBeNull();
    // The proof verifies — leaf reconstructs the claim root, root
    // recomputes the canonical attestation digest, and the carried
    // signature verifies against it.
    const result = verifyDisclosureProof(proof!);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    // The disclosed leaf names the action and carries the
    // {threshold, eligible} payload — the Phase B verifier reads
    // these to gate the consuming envelope.
    expect(proof?.leaf.name).toBe('expulsion');
    const payload = JSON.parse(String(proof?.leaf.value)) as {
      threshold: number;
      eligible: string[];
    };
    expect(payload.threshold).toBe(2);
    expect(payload.eligible).toHaveLength(3);
  });

  it('returns null when the action is not declared', () => {
    const w = freshWallet();
    const rules: AuthRule[] = [
      { action: 'routine_issuance', threshold: 1, eligible: [w.identity] },
    ];
    const decl = inlineSelfDeclaration(w, 'Acme', rules);
    expect(proveAuthorization(decl, 'dissolution')).toBeNull();
  });

  it('returns null when the self-declaration has no auth branch', () => {
    const w = freshWallet();
    const draft = credentialAttestation({
      subject: w.identity,
      tier: 'notable',
      fields: {
        credential_type: 'organization',
        org_name: 'Legacy Org',
        pubkey: w.identity,
        declared_at: new Date().toISOString(),
      },
    });
    const decl = w.sign(draft);
    expect(proveAuthorization(decl, 'routine_issuance')).toBeNull();
  });

  it('cross-envelope binding: a tampered self-declaration fails verification', () => {
    // Real org issues a rule. Attacker takes the SAME disclosure proof
    // and tries to attach it to a tampered self-declaration claim. The
    // verifier reconstructs the claim root from the leaf+path INSIDE
    // the proof bundle — that reconstruction is fixed at proof
    // creation time and signed; tampering the declaration after the
    // fact cannot change what the proof reconstructs to. This test
    // confirms a hand-crafted proof against a tampered envelope still
    // fails because the carried signature was made over the original
    // claim digest, not the tampered one.
    const w = freshWallet();
    const decl = inlineSelfDeclaration(w, 'Real Acme', [
      { action: 'routine_issuance', threshold: 1, eligible: [w.identity] },
    ]);
    const proof = proveAuthorization(decl, 'routine_issuance');
    expect(proof).not.toBeNull();
    // Forge a proof whose leaf claims a much higher threshold than
    // what was actually signed. The reconstruction of the claim root
    // from the forged leaf will not match the signed digest.
    const forged = {
      ...proof!,
      leaf: {
        ...proof!.leaf,
        value: JSON.stringify({ threshold: 5, eligible: [w.identity] }),
      },
    };
    const result = verifyDisclosureProof(forged);
    expect(result.valid).toBe(false);
  });
});

describe('auth-tree presence on a real selfDeclareOrganization throw path', () => {
  // Sanity-check that the synchronous validation gates fire before
  // any async IDB work — the throws above prove this, but explicitly
  // assert the function does NOT silently swallow zero-eligible or
  // empty-rule edge cases.
  it('an empty rules array is permitted (verifier-side concern, not creation-side)', async () => {
    // Passing [] means "no governance rules at all" — the wallet
    // builder accepts this (consistent with the no-auth-branch
    // legacy case), and the Phase B verifier is responsible for
    // refusing to authorize actions against an org with no rules.
    const w = freshWallet();
    // Synchronous validation should pass; only the async hold/anchor
    // would fail in jsdom (no IDB). Catch the IDB failure but assert
    // no validation error fired first.
    let validationErr: unknown = null;
    try {
      await selfDeclareOrganization(w, 'owner-id', null, 'Empty Rules Org', []);
    } catch (e) {
      validationErr = e;
    }
    // Either the call succeeded (test env has IDB shim) or it failed
    // at the IDB layer — not at our validation layer.
    if (validationErr) {
      const msg = String(validationErr);
      expect(msg).not.toMatch(/duplicate auth rule action/);
      expect(msg).not.toMatch(/threshold must be a positive integer/);
      expect(msg).not.toMatch(/exceeds eligible count/);
      expect(msg).not.toMatch(/org name must not be empty/);
    }
  });
});

// =============================================================================
// Phase 8 Phase B — verifyOrgAuthorization + authorized_by leaf
// =============================================================================
//
// Phase B tests defend against four forgery classes. Phase A's
// `tampered self-declaration fails verification` test covered class #1
// (leaf-value tampered) at the disclosure-proof layer; Phase B tests
// re-cover it at the verifyOrgAuthorization layer plus the three new
// classes (wrong-org-binding, tampered-path, tampered-meta) flagged in
// the Phase A close-out opinions.

describe('encodeAuthorizedBy / decodeAuthorizedBy — payload round-trip', () => {
  it('round-trips a valid payload', () => {
    const w = freshWallet();
    const decl = inlineSelfDeclaration(w, 'Acme', [
      { action: 'routine_issuance', threshold: 1, eligible: [w.identity] },
    ]);
    const payload = buildAuthorizedByPayload(decl, 'routine_issuance');
    expect(payload).not.toBeNull();
    const encoded = encodeAuthorizedBy(payload!);
    const decoded = decodeAuthorizedBy(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.org_identity).toBe(payload?.org_identity);
    expect(decoded?.action).toBe(payload?.action);
  });

  it('decodes returns null on non-string input', () => {
    expect(decodeAuthorizedBy(42)).toBeNull();
    expect(decodeAuthorizedBy(null)).toBeNull();
    expect(decodeAuthorizedBy(undefined)).toBeNull();
    expect(decodeAuthorizedBy({})).toBeNull();
  });

  it('decodes returns null on malformed JSON', () => {
    expect(decodeAuthorizedBy('not json')).toBeNull();
    expect(decodeAuthorizedBy('[]')).toBeNull(); // array, not object
    expect(decodeAuthorizedBy('null')).toBeNull();
  });

  it('decodes returns null when required fields are missing', () => {
    expect(decodeAuthorizedBy(JSON.stringify({ org_identity: 'a' }))).toBeNull();
    expect(decodeAuthorizedBy(JSON.stringify({ org_identity: 'a', action: 'x' }))).toBeNull();
    expect(
      decodeAuthorizedBy(JSON.stringify({ action: 'x', proof: {} })),
    ).toBeNull();
  });
});

describe('buildAuthorizedByPayload', () => {
  it('returns null when the action is not in the org auth tree', () => {
    const w = freshWallet();
    const decl = inlineSelfDeclaration(w, 'Acme', [
      { action: 'routine_issuance', threshold: 1, eligible: [w.identity] },
    ]);
    expect(buildAuthorizedByPayload(decl, 'dissolution')).toBeNull();
  });

  it('builds a payload whose proof leaf name matches the action', () => {
    const w = freshWallet();
    const decl = inlineSelfDeclaration(w, 'Acme', [
      { action: 'expulsion', threshold: 2, eligible: [w.identity, 'b'.repeat(64), 'c'.repeat(64)] },
    ]);
    const payload = buildAuthorizedByPayload(decl, 'expulsion');
    expect(payload?.action).toBe('expulsion');
    expect(payload?.proof.leaf.name).toBe('expulsion');
    expect(payload?.org_identity).toBe(w.identity);
  });
});

describe('verifyOrgAuthorization — happy path', () => {
  it('accepts an envelope whose authorized_by proof verifies and meets threshold', () => {
    const w = freshWallet();
    const decl = inlineSelfDeclaration(w, 'Acme', [
      { action: 'routine_issuance', threshold: 1, eligible: [w.identity] },
    ]);
    const credential = inlineAuthorizedCredential(decl, 'routine_issuance', [w]);
    const result = verifyOrgAuthorization(credential, [decl]);
    expect(result.authorized).toBe(true);
    expect(result.eligibleCount).toBe(1);
    expect(result.thresholdRequired).toBe(1);
  });

  it('counts only DISTINCT eligible signers (duplicates collapse via Set)', () => {
    const w = freshWallet();
    const decl = inlineSelfDeclaration(w, 'Acme', [
      { action: 'routine_issuance', threshold: 1, eligible: [w.identity] },
    ]);
    // Sign three times with the same wallet — Set-based dedup means
    // this counts as ONE eligible signer, still meeting threshold=1.
    const credential = inlineAuthorizedCredential(decl, 'routine_issuance', [w, w, w]);
    const result = verifyOrgAuthorization(credential, [decl]);
    expect(result.authorized).toBe(true);
    expect(result.eligibleCount).toBe(1);
  });

  it('accepts when threshold is met by multiple distinct eligible signers', () => {
    const officerA = Wallet.generate();
    const officerB = Wallet.generate();
    const officerC = Wallet.generate();
    const orgWallet = freshWallet();
    const decl = inlineSelfDeclaration(orgWallet, 'Acme', [
      {
        action: 'expulsion',
        threshold: 2,
        eligible: [officerA.identity, officerB.identity, officerC.identity],
      },
    ]);
    // Two of three officers sign — threshold=2 met.
    const credential = inlineAuthorizedCredential(decl, 'expulsion', [officerA, officerB]);
    const result = verifyOrgAuthorization(credential, [decl]);
    expect(result.authorized).toBe(true);
    expect(result.eligibleCount).toBe(2);
    expect(result.thresholdRequired).toBe(2);
  });
});

describe('verifyOrgAuthorization — refusal cases (non-forgery)', () => {
  it('refuses when the envelope has no authorized_by leaf', () => {
    const w = freshWallet();
    const decl = inlineSelfDeclaration(w, 'Acme', [
      { action: 'routine_issuance', threshold: 1, eligible: [w.identity] },
    ]);
    const draft = credentialAttestation({
      subject: 'a'.repeat(64),
      tier: 'notable',
      fields: { credential_type: 'test_unauthorized', issued_at: new Date().toISOString() },
    });
    const signed = w.sign(draft);
    const result = verifyOrgAuthorization(signed, [decl]);
    expect(result.authorized).toBe(false);
    expect(result.reason).toMatch(/no authorized_by leaf/);
  });

  it('refuses when the authorized_by leaf is malformed JSON', () => {
    const w = freshWallet();
    const decl = inlineSelfDeclaration(w, 'Acme', [
      { action: 'routine_issuance', threshold: 1, eligible: [w.identity] },
    ]);
    const draft = credentialAttestation({
      subject: 'a'.repeat(64),
      tier: 'notable',
      fields: {
        credential_type: 'test_org_issued',
        authorized_by: 'this is not json',
      },
    });
    const signed = w.sign(draft);
    const result = verifyOrgAuthorization(signed, [decl]);
    expect(result.authorized).toBe(false);
    expect(result.reason).toMatch(/malformed/);
  });

  it('refuses when the named org is not in knownOrgs', () => {
    const w = freshWallet();
    const decl = inlineSelfDeclaration(w, 'Acme', [
      { action: 'routine_issuance', threshold: 1, eligible: [w.identity] },
    ]);
    const credential = inlineAuthorizedCredential(decl, 'routine_issuance', [w]);
    // Pass empty knownOrgs — the lookup misses.
    const result = verifyOrgAuthorization(credential, []);
    expect(result.authorized).toBe(false);
    expect(result.reason).toMatch(/not held locally/);
  });

  it('refuses when the threshold is not met', () => {
    const officerA = Wallet.generate();
    const officerB = Wallet.generate();
    const officerC = Wallet.generate();
    const orgWallet = freshWallet();
    const decl = inlineSelfDeclaration(orgWallet, 'Acme', [
      {
        action: 'expulsion',
        threshold: 3,
        eligible: [officerA.identity, officerB.identity, officerC.identity],
      },
    ]);
    // Only TWO officers sign; threshold=3.
    const credential = inlineAuthorizedCredential(decl, 'expulsion', [officerA, officerB]);
    const result = verifyOrgAuthorization(credential, [decl]);
    expect(result.authorized).toBe(false);
    expect(result.reason).toMatch(/threshold not met/);
    expect(result.eligibleCount).toBe(2);
    expect(result.thresholdRequired).toBe(3);
  });

  it('refuses when the signer is not in the eligible set', () => {
    const orgWallet = freshWallet();
    const eligibleW = Wallet.generate();
    const ineligibleW = Wallet.generate();
    const decl = inlineSelfDeclaration(orgWallet, 'Acme', [
      { action: 'routine_issuance', threshold: 1, eligible: [eligibleW.identity] },
    ]);
    // Sign with an ineligible wallet only.
    const credential = inlineAuthorizedCredential(decl, 'routine_issuance', [ineligibleW]);
    const result = verifyOrgAuthorization(credential, [decl]);
    expect(result.authorized).toBe(false);
    expect(result.reason).toMatch(/threshold not met/);
    expect(result.eligibleCount).toBe(0);
  });
});

describe('verifyOrgAuthorization — four forgery classes', () => {
  it('FORGERY CLASS 1 — leaf-value tampered', () => {
    // Attacker takes a real proof and rewrites the disclosed leaf's value
    // to claim a different threshold/eligible. verifyDisclosureProof
    // catches this because the recomputed claim root no longer matches
    // the signed digest.
    const w = freshWallet();
    const decl = inlineSelfDeclaration(w, 'Acme', [
      { action: 'routine_issuance', threshold: 1, eligible: [w.identity] },
    ]);
    const credential = inlineAuthorizedCredential(decl, 'routine_issuance', [w]);
    // Mutate the encoded leaf value inside the credential's authorized_by leaf.
    const rawLeaf = credential.claim.children.find(
      (c) => c.node === 'leaf' && c.name === 'authorized_by',
    );
    if (!rawLeaf || rawLeaf.node !== 'leaf') throw new Error('test setup: leaf missing');
    const decoded = decodeAuthorizedBy(rawLeaf.value);
    if (!decoded) throw new Error('test setup: decode failed');
    const forgedPayload: AuthorizedByPayload = {
      ...decoded,
      proof: {
        ...decoded.proof,
        leaf: {
          ...decoded.proof.leaf,
          value: JSON.stringify({ threshold: 99, eligible: [w.identity] }),
        },
      },
    };
    // Construct a forged envelope carrying the tampered payload. We have to
    // re-sign it because the envelope's signature covers the leaf; in a real
    // attack the attacker controls a wallet so can re-sign with their own key,
    // but the disclosure-proof verification still fails before the eligible
    // count is even reached.
    const forgedDraft = credentialAttestation({
      subject: 'a'.repeat(64),
      tier: 'notable',
      fields: {
        credential_type: 'test_org_issued',
        issued_at: new Date().toISOString(),
        authorized_by: encodeAuthorizedBy(forgedPayload),
      },
    });
    const forgedCredential = w.sign(forgedDraft);
    const result = verifyOrgAuthorization(forgedCredential, [decl]);
    expect(result.authorized).toBe(false);
    expect(result.reason).toMatch(/disclosure proof invalid|different attestation/);
  });

  it('FORGERY CLASS 2 — wrong-org-binding (proof made against a different self-declaration)', () => {
    // Attacker takes a valid proof from self-decl-A and tries to bind it
    // to a CLAIM that the proof came from self-decl-B (same wallet, but
    // a re-signed declaration with a different timestamp = different digest).
    const w = freshWallet();
    const declOlder = inlineSelfDeclaration(
      w,
      'Acme',
      [{ action: 'routine_issuance', threshold: 1, eligible: [w.identity] }],
      '2026-01-01T00:00:00.000Z',
    );
    const declNewer = inlineSelfDeclaration(
      w,
      'Acme',
      [{ action: 'routine_issuance', threshold: 1, eligible: [w.identity] }],
      '2026-06-01T00:00:00.000Z',
    );
    // Build a credential whose authorized_by carries a proof of declOlder,
    // but knownOrgs only contains declNewer (same wallet, same subject,
    // different digest).
    const credential = inlineAuthorizedCredential(declOlder, 'routine_issuance', [w]);
    const result = verifyOrgAuthorization(credential, [declNewer]);
    expect(result.authorized).toBe(false);
    expect(result.reason).toMatch(/different attestation/);
  });

  it('FORGERY CLASS 3 — tampered sibling-hash path', () => {
    // Attacker mutates a sibling hash in the disclosure proof's steps array,
    // hoping the recomputed root will happen to land on the signed digest.
    // It won't — taggedHash is preimage-resistant.
    const w = freshWallet();
    const decl = inlineSelfDeclaration(w, 'Acme', [
      { action: 'routine_issuance', threshold: 1, eligible: [w.identity] },
    ]);
    const credential = inlineAuthorizedCredential(decl, 'routine_issuance', [w]);
    const rawLeaf = credential.claim.children.find(
      (c) => c.node === 'leaf' && c.name === 'authorized_by',
    );
    if (!rawLeaf || rawLeaf.node !== 'leaf') throw new Error('test setup: leaf missing');
    const decoded = decodeAuthorizedBy(rawLeaf.value);
    if (!decoded) throw new Error('test setup: decode failed');
    // Tamper the first sibling-hash of the first step.
    const firstStep = decoded.proof.steps[0];
    if (!firstStep || firstStep.siblingHashes.length === 0) {
      throw new Error('test setup: no siblings to tamper');
    }
    const tamperedSibling = '0'.repeat(64);
    const forgedPayload: AuthorizedByPayload = {
      ...decoded,
      proof: {
        ...decoded.proof,
        steps: [
          {
            ...firstStep,
            siblingHashes: [tamperedSibling, ...firstStep.siblingHashes.slice(1)],
          },
          ...decoded.proof.steps.slice(1),
        ],
      },
    };
    const forgedDraft = credentialAttestation({
      subject: 'a'.repeat(64),
      tier: 'notable',
      fields: {
        credential_type: 'test_org_issued',
        issued_at: new Date().toISOString(),
        authorized_by: encodeAuthorizedBy(forgedPayload),
      },
    });
    const forgedCredential = w.sign(forgedDraft);
    const result = verifyOrgAuthorization(forgedCredential, [decl]);
    expect(result.authorized).toBe(false);
    expect(result.reason).toMatch(/disclosure proof invalid|different attestation/);
  });

  it('FORGERY CLASS 4 — tampered meta-fields', () => {
    // Attacker rewrites proof.meta.subject (or issuedAt) hoping verifyDisclosureProof
    // will accept the recomputed digest. It won't — digest = taggedHash(metaHash, claimRoot)
    // and metaHash depends on every meta field.
    const w = freshWallet();
    const decl = inlineSelfDeclaration(w, 'Acme', [
      { action: 'routine_issuance', threshold: 1, eligible: [w.identity] },
    ]);
    const credential = inlineAuthorizedCredential(decl, 'routine_issuance', [w]);
    const rawLeaf = credential.claim.children.find(
      (c) => c.node === 'leaf' && c.name === 'authorized_by',
    );
    if (!rawLeaf || rawLeaf.node !== 'leaf') throw new Error('test setup: leaf missing');
    const decoded = decodeAuthorizedBy(rawLeaf.value);
    if (!decoded) throw new Error('test setup: decode failed');
    const forgedPayload: AuthorizedByPayload = {
      ...decoded,
      proof: {
        ...decoded.proof,
        meta: {
          ...decoded.proof.meta,
          // Rewrite the subject — meta-fields are signed via metaHash so
          // any drift breaks the recomputed digest.
          subject: 'd'.repeat(64),
        },
      },
    };
    const forgedDraft = credentialAttestation({
      subject: 'a'.repeat(64),
      tier: 'notable',
      fields: {
        credential_type: 'test_org_issued',
        issued_at: new Date().toISOString(),
        authorized_by: encodeAuthorizedBy(forgedPayload),
      },
    });
    const forgedCredential = w.sign(forgedDraft);
    const result = verifyOrgAuthorization(forgedCredential, [decl]);
    expect(result.authorized).toBe(false);
    expect(result.reason).toMatch(/disclosure proof invalid|different attestation/);
  });

  it('action-claim mismatch — payload claims one action but proof discloses another', () => {
    // Edge case adjacent to the forgery classes: the disclosure proof is
    // structurally valid AND binds to the correct org, but the payload's
    // `action` field doesn't match the leaf the proof actually discloses.
    // Without this check, an attacker could glue a routine_issuance proof
    // onto a credential claiming to be authorized under expulsion.
    const w = freshWallet();
    const decl = inlineSelfDeclaration(w, 'Acme', [
      { action: 'routine_issuance', threshold: 1, eligible: [w.identity] },
      { action: 'expulsion', threshold: 1, eligible: [w.identity] },
    ]);
    // Build a payload whose proof is of routine_issuance but action claims expulsion.
    const proofForRoutine = proveAuthorization(decl, 'routine_issuance');
    if (!proofForRoutine) throw new Error('test setup');
    const forgedPayload: AuthorizedByPayload = {
      org_identity: decl.subject,
      action: 'expulsion',
      proof: proofForRoutine,
    };
    const forgedDraft = credentialAttestation({
      subject: 'a'.repeat(64),
      tier: 'notable',
      fields: {
        credential_type: 'test_org_issued',
        issued_at: new Date().toISOString(),
        authorized_by: encodeAuthorizedBy(forgedPayload),
      },
    });
    const forgedCredential = w.sign(forgedDraft);
    const result = verifyOrgAuthorization(forgedCredential, [decl]);
    expect(result.authorized).toBe(false);
    expect(result.reason).toMatch(/discloses rule.*but action claims/);
  });
});
