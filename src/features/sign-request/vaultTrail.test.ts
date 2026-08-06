import { describe, it, expect } from 'vitest';
import { Wallet } from 'tapit-attest';
import {
  isVaultMembership,
  readVaultMembership,
  findVaultTrail,
  isKnownLeafScript,
  requiresCallbackConfirmation,
} from './vaultTrail.ts';

const DESCRIPTOR = 'tr_multileaf(...)';
const LEAF_SCRIPT_HEX = '5187';

function membershipAttestation(wallet: Wallet, overrides: Partial<{
  vaultDescriptor: string;
  leafScripts: string[];
  threshold: string;
}> = {}) {
  const signed = wallet.attest({
    kind: 'agreement',
    tier: 'high_stakes',
    subject: overrides.vaultDescriptor ?? DESCRIPTOR,
    fields: {
      agreement_type: 'vault-membership',
      vault_descriptor: overrides.vaultDescriptor ?? DESCRIPTOR,
      vault_name: 'Family Trust',
      role: 'founder',
      leaf_scripts: JSON.stringify(overrides.leafScripts ?? [LEAF_SCRIPT_HEX]),
      ...(overrides.threshold !== undefined
        ? { high_value_threshold_sats: overrides.threshold }
        : {}),
    },
  });
  return signed;
}

describe('isVaultMembership / readVaultMembership', () => {
  it('identifies a vault-membership agreement and reads its fields', () => {
    const wallet = Wallet.generate();
    const att = membershipAttestation(wallet, { threshold: '1000000' });
    expect(isVaultMembership(att)).toBe(true);
    const view = readVaultMembership(att);
    expect(view.vaultDescriptor).toBe(DESCRIPTOR);
    expect(view.vaultName).toBe('Family Trust');
    expect(view.role).toBe('founder');
    expect(view.leafScripts).toEqual([LEAF_SCRIPT_HEX]);
    expect(view.highValueThresholdSats).toBe(1000000n);
  });

  it('is not mistaken for another agreement', () => {
    const wallet = Wallet.generate();
    const other = wallet.attest({
      kind: 'agreement',
      tier: 'notable',
      subject: 'something else',
      fields: { agreement_type: 'trust_doc' },
    });
    expect(isVaultMembership(other)).toBe(false);
  });

  it('defaults to no threshold and empty leaf scripts when absent/malformed', () => {
    const wallet = Wallet.generate();
    const att = wallet.attest({
      kind: 'agreement',
      tier: 'high_stakes',
      subject: DESCRIPTOR,
      fields: { agreement_type: 'vault-membership', vault_descriptor: DESCRIPTOR },
    });
    const view = readVaultMembership(att);
    expect(view.leafScripts).toEqual([]);
    expect(view.highValueThresholdSats).toBeNull();
  });
});

describe('findVaultTrail', () => {
  it('finds a held membership this wallet itself signed', () => {
    const wallet = Wallet.generate();
    const att = membershipAttestation(wallet);
    const found = findVaultTrail([att], DESCRIPTOR, wallet.publicKey);
    expect(found).not.toBeNull();
  });

  it('returns null when no membership matches the descriptor', () => {
    const wallet = Wallet.generate();
    const att = membershipAttestation(wallet, { vaultDescriptor: 'a different vault' });
    expect(findVaultTrail([att], DESCRIPTOR, wallet.publicKey)).toBeNull();
  });

  it('returns null when the wallet is not among the signers -- refuses a trail signed by someone else', () => {
    const issuer = Wallet.generate();
    const me = Wallet.generate();
    const att = membershipAttestation(issuer);
    expect(findVaultTrail([att], DESCRIPTOR, me.publicKey)).toBeNull();
  });

  it('returns null on empty holdings', () => {
    const wallet = Wallet.generate();
    expect(findVaultTrail([], DESCRIPTOR, wallet.publicKey)).toBeNull();
  });
});

describe('isKnownLeafScript', () => {
  it('accepts a script byte-matching the held membership', () => {
    const wallet = Wallet.generate();
    const att = membershipAttestation(wallet);
    expect(isKnownLeafScript(att, LEAF_SCRIPT_HEX)).toBe(true);
    expect(isKnownLeafScript(att, LEAF_SCRIPT_HEX.toUpperCase())).toBe(true);
  });

  it('rejects a script not in the held membership -- the no-rogue-signing gate', () => {
    const wallet = Wallet.generate();
    const att = membershipAttestation(wallet);
    expect(isKnownLeafScript(att, 'deadbeef')).toBe(false);
  });
});

describe('requiresCallbackConfirmation', () => {
  it('is fail-closed (always required) when no threshold is declared', () => {
    const wallet = Wallet.generate();
    const att = membershipAttestation(wallet);
    expect(requiresCallbackConfirmation(att, 1n)).toBe(true);
    expect(requiresCallbackConfirmation(att, 1_000_000_000n)).toBe(true);
  });

  it('requires the callback at or above the declared threshold', () => {
    const wallet = Wallet.generate();
    const att = membershipAttestation(wallet, { threshold: '1000000' });
    expect(requiresCallbackConfirmation(att, 999_999n)).toBe(false);
    expect(requiresCallbackConfirmation(att, 1_000_000n)).toBe(true);
    expect(requiresCallbackConfirmation(att, 5_000_000n)).toBe(true);
  });
});
