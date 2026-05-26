import { describe, it, expect } from 'vitest';
import {
  buildAuthSubtree,
  decodeAuthRuleValue,
  encodeAuthRuleValue,
  isJoinRule,
  isOrgActionRule,
  type AuthRule,
  type AuthRuleForJoin,
  type AuthRuleForOrgAction,
  type JoinPolicy,
} from './authRule.ts';

// Phase 8 Phase E1 — the AuthRule type is now a discriminated union
// of org-action rules (signer-side; {threshold, eligible}) and join
// rules (joiner-side; {policy: ...}). These tests exercise the
// data-model layer: every policy kind round-trips through
// encode → decode unchanged, buildAuthSubtree validates kind-specific
// constraints, and the type guards do what they say. No verifier
// here, no UI here — that lives in Phase E2/E3/E4. See
// project-memory/foreman-memory/projects/tapit-wallet/briefs/
// 2026-05-25-open-joining-and-configurable-membership-policy-roadmap.md.

function roundTrip(rule: AuthRule): AuthRule {
  const encoded = encodeAuthRuleValue(rule);
  const decoded = decodeAuthRuleValue(rule.action, encoded);
  if (!decoded) throw new Error(`round-trip decode returned null for action='${rule.action}'`);
  return decoded;
}

describe('AuthRule discriminated union — type guards', () => {
  it('isJoinRule identifies a join rule', () => {
    const r: AuthRuleForJoin = { action: 'join', policy: { kind: 'open' } };
    expect(isJoinRule(r)).toBe(true);
    expect(isOrgActionRule(r)).toBe(false);
  });

  it('isOrgActionRule identifies an org-action rule', () => {
    const r: AuthRuleForOrgAction = {
      action: 'routine_issuance',
      threshold: 1,
      eligible: ['a'.repeat(64)],
    };
    expect(isOrgActionRule(r)).toBe(true);
    expect(isJoinRule(r)).toBe(false);
  });

  it('a rule whose action is the string "join" but lacks a policy is NOT a join rule', () => {
    // This shouldn't happen in practice (the type rejects it at
    // construction) but the runtime guard should still reject so a
    // malformed decode result cannot pretend to be a join rule.
    const ambiguous = { action: 'join', threshold: 1, eligible: ['x'] } as unknown as AuthRule;
    expect(isJoinRule(ambiguous)).toBe(false);
  });
});

describe('JoinPolicy — encode/decode round-trip per kind', () => {
  const aHex = 'a'.repeat(64);
  const bHex = 'b'.repeat(64);

  function joinRule(policy: JoinPolicy): AuthRuleForJoin {
    return { action: 'join', policy };
  }

  it('kind=open round-trips with no extra fields', () => {
    const decoded = roundTrip(joinRule({ kind: 'open' }));
    expect(decoded.action).toBe('join');
    if (!isJoinRule(decoded)) throw new Error('expected join rule');
    expect(decoded.policy).toEqual({ kind: 'open' });
  });

  it('kind=allow_list round-trips with pubkeys sorted+lowercased', () => {
    const decoded = roundTrip(
      joinRule({ kind: 'allow_list', pubkeys: [bHex.toUpperCase(), aHex] }),
    );
    if (!isJoinRule(decoded)) throw new Error('expected join rule');
    expect(decoded.policy).toEqual({ kind: 'allow_list', pubkeys: [aHex, bHex] });
  });

  it('kind=deny_list round-trips with pubkeys sorted+lowercased', () => {
    const decoded = roundTrip(joinRule({ kind: 'deny_list', pubkeys: [bHex, aHex] }));
    if (!isJoinRule(decoded)) throw new Error('expected join rule');
    expect(decoded.policy).toEqual({ kind: 'deny_list', pubkeys: [aHex, bHex] });
  });

  it('kind=requires_handshake round-trips with with_any_of sorted+lowercased', () => {
    const decoded = roundTrip(
      joinRule({ kind: 'requires_handshake', with_any_of: [bHex, aHex] }),
    );
    if (!isJoinRule(decoded)) throw new Error('expected join rule');
    expect(decoded.policy).toEqual({
      kind: 'requires_handshake',
      with_any_of: [aHex, bHex],
    });
  });

  it('kind=requires_credential round-trips without issuer', () => {
    const decoded = roundTrip(
      joinRule({ kind: 'requires_credential', credential_type: 'membership' }),
    );
    if (!isJoinRule(decoded)) throw new Error('expected join rule');
    expect(decoded.policy).toEqual({
      kind: 'requires_credential',
      credential_type: 'membership',
    });
  });

  it('kind=requires_credential round-trips with issuer lowercased', () => {
    const decoded = roundTrip(
      joinRule({
        kind: 'requires_credential',
        credential_type: 'membership',
        issuer: aHex.toUpperCase(),
      }),
    );
    if (!isJoinRule(decoded)) throw new Error('expected join rule');
    expect(decoded.policy).toEqual({
      kind: 'requires_credential',
      credential_type: 'membership',
      issuer: aHex,
    });
  });

  it('kind=requires_vouch round-trips with from_any_member_count', () => {
    const decoded = roundTrip(joinRule({ kind: 'requires_vouch', from_any_member_count: 3 }));
    if (!isJoinRule(decoded)) throw new Error('expected join rule');
    expect(decoded.policy).toEqual({
      kind: 'requires_vouch',
      from_any_member_count: 3,
    });
  });
});

describe('decodeAuthRuleValue — rejects malformed payloads', () => {
  it('returns null when join policy is missing', () => {
    expect(decodeAuthRuleValue('join', JSON.stringify({}))).toBeNull();
  });

  it('returns null when join policy has unknown kind', () => {
    expect(
      decodeAuthRuleValue('join', JSON.stringify({ policy: { kind: 'magic' } })),
    ).toBeNull();
  });

  it('returns null when allow_list pubkeys is not an array', () => {
    expect(
      decodeAuthRuleValue(
        'join',
        JSON.stringify({ policy: { kind: 'allow_list', pubkeys: 'notalist' } }),
      ),
    ).toBeNull();
  });

  it('returns null when requires_credential credential_type is empty', () => {
    expect(
      decodeAuthRuleValue(
        'join',
        JSON.stringify({ policy: { kind: 'requires_credential', credential_type: '' } }),
      ),
    ).toBeNull();
  });

  it('returns null when requires_vouch count is not a positive integer', () => {
    expect(
      decodeAuthRuleValue(
        'join',
        JSON.stringify({ policy: { kind: 'requires_vouch', from_any_member_count: 0 } }),
      ),
    ).toBeNull();
    expect(
      decodeAuthRuleValue(
        'join',
        JSON.stringify({ policy: { kind: 'requires_vouch', from_any_member_count: 1.5 } }),
      ),
    ).toBeNull();
  });

  it('an org-action rule encoded value still decodes under a non-join action name', () => {
    // Sanity: backward compatibility — existing pre-E1 declarations
    // still decode unchanged.
    const decoded = decodeAuthRuleValue(
      'routine_issuance',
      JSON.stringify({ threshold: 1, eligible: ['a'.repeat(64)] }),
    );
    expect(decoded).not.toBeNull();
    expect(decoded?.action).toBe('routine_issuance');
    if (!decoded || !isOrgActionRule(decoded)) throw new Error('expected org-action');
    expect(decoded.threshold).toBe(1);
    expect(decoded.eligible).toEqual(['a'.repeat(64)]);
  });
});

describe('buildAuthSubtree — validates both kinds', () => {
  const founder = 'a'.repeat(64);

  it('accepts a mixed rule set with one org-action and one join rule', () => {
    const rules: AuthRule[] = [
      { action: 'routine_issuance', threshold: 1, eligible: [founder] },
      { action: 'join', policy: { kind: 'open' } },
    ];
    const subtree = buildAuthSubtree(rules);
    expect(Object.keys(subtree).sort()).toEqual(['join', 'routine_issuance']);
  });

  it('throws on duplicate action — same name across the two kinds is still a duplicate', () => {
    const rules: AuthRule[] = [
      { action: 'join', policy: { kind: 'open' } },
      { action: 'join', policy: { kind: 'allow_list', pubkeys: [founder] } },
    ];
    expect(() => buildAuthSubtree(rules)).toThrow(/duplicate auth rule action: join/);
  });

  it('throws when requires_handshake.with_any_of is empty', () => {
    const rules: AuthRule[] = [
      { action: 'join', policy: { kind: 'requires_handshake', with_any_of: [] } },
    ];
    expect(() => buildAuthSubtree(rules)).toThrow(/with_any_of must name at least one pubkey/);
  });

  it('throws when requires_credential.credential_type is empty', () => {
    const rules: AuthRule[] = [
      { action: 'join', policy: { kind: 'requires_credential', credential_type: '' } },
    ];
    expect(() => buildAuthSubtree(rules)).toThrow(/credential_type must be non-empty/);
  });

  it('throws when requires_vouch.from_any_member_count is zero', () => {
    const rules: AuthRule[] = [
      { action: 'join', policy: { kind: 'requires_vouch', from_any_member_count: 0 } },
    ];
    expect(() => buildAuthSubtree(rules)).toThrow(/from_any_member_count must be a positive integer/);
  });

  it('still throws on existing org-action validation paths', () => {
    const rules: AuthRule[] = [
      { action: 'routine_issuance', threshold: 0, eligible: [founder] },
    ];
    expect(() => buildAuthSubtree(rules)).toThrow(/threshold must be a positive integer/);
  });
});
