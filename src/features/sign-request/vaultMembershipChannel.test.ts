import { describe, expect, it } from 'vitest';
import { isVaultMembershipRequestPayload, isVaultMembershipRole } from './vaultMembershipChannel.ts';

// 2026-11-24 (operator: "Vault request didn't show up in tap it this time.
// It has worked before in aug but silent this go."): a path-builder vault's
// request names its role by PATH id, and this guard used to allow only the
// six named roles, so the request was dropped silently.
const base = {
  v: 1,
  vault_descriptor: 'tr(nums,{pk(a),and_v(v:pk(b),older(8640))})',
  vault_name: 'Family',
  leaf_scripts: ['20' + 'ab'.repeat(32) + 'ac'],
};

describe('vault membership request guard', () => {
  it('accepts the six named roles, as before', () => {
    for (const role of ['founder', 'heir', 'protector', 'backup', 'consent', 'second_heir']) {
      expect(isVaultMembershipRequestPayload({ ...base, role })).toBe(true);
    }
  });

  it('accepts a path-builder vault role (its path id), with or without the path name', () => {
    expect(isVaultMembershipRequestPayload({ ...base, role: 'everyday' })).toBe(true);
    expect(isVaultMembershipRequestPayload({ ...base, role: 'path_2', role_label: 'If left untouched' })).toBe(true);
    expect(isVaultMembershipRequestPayload({ ...base, role: 'path-17' })).toBe(true);
  });

  it('still refuses a role that is not a name or a path id, and a bad path name', () => {
    for (const role of ['', 'has space', 'semi;colon', 'x'.repeat(65), 42, null, undefined]) {
      expect(isVaultMembershipRole(role)).toBe(false);
      expect(isVaultMembershipRequestPayload({ ...base, role })).toBe(false);
    }
    expect(isVaultMembershipRequestPayload({ ...base, role: 'everyday', role_label: 7 })).toBe(false);
    expect(isVaultMembershipRequestPayload({ ...base, role: 'everyday', role_label: 'x'.repeat(81) })).toBe(false);
  });
});
