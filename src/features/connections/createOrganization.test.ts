import { describe, it, expect } from 'vitest';
import {
  Wallet,
  credentialAttestation,
  verifyDisclosureProof,
} from 'tapit-attest';
import type { Attestation } from 'tapit-attest';

import {
  findAuthRule,
  isOrganizationSelfDeclaration,
  listAuthRules,
  proveAuthorization,
  selfDeclareOrganization,
  type AuthRule,
} from './createOrganization.ts';

// Phase 8 Phase A — Tapscript-style authorization tree on the org
// self-declaration. These tests exercise the rule encode/decode
// round-trip and the cross-envelope disclosure-proof primitive used
// to authorize org-issued envelopes downstream (Phase B verifier
// will consume what proveAuthorization produces here).

function freshWallet(): Wallet {
  return Wallet.generate();
}

// Mirror the auth-subtree encoding used inside selfDeclareOrganization
// for tests that need to build a signed self-declaration inline
// without touching the async hold/anchor pipeline (jsdom has no IDB).
function inlineSelfDeclaration(
  wallet: Wallet,
  orgName: string,
  authRules: readonly AuthRule[],
): Attestation {
  const auth: Record<string, string> = {};
  for (const r of authRules) {
    const eligibleSorted = [...r.eligible].map((e) => e.trim().toLowerCase()).sort();
    auth[r.action] = JSON.stringify({
      threshold: r.threshold,
      eligible: eligibleSorted,
    });
  }
  const draft = credentialAttestation({
    subject: wallet.identity,
    tier: 'notable',
    fields: {
      credential_type: 'organization',
      org_name: orgName,
      pubkey: wallet.identity,
      declared_at: new Date().toISOString(),
      auth,
    },
  });
  return wallet.sign(draft);
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
