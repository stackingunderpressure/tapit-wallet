import { describe, it, expect } from 'vitest';
import { Wallet } from 'tapit-attest';
import {
  isVaultMembership,
  readVaultMembership,
  findVaultTrail,
  isKnownLeafScript,
  requiresCallbackConfirmation,
  diagnoseVaultTrail,
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

  it('2026-08-11 fix: finds a membership signed by a since-rotated-away key when the current key history is passed', () => {
    // Simulates a wallet that accepted a vault-membership BEFORE rotating:
    // the attestation is permanently signed by the retired key, but the
    // wallet's continuous identity now includes both keys in its history.
    const retiredKey = Wallet.generate();
    const att = membershipAttestation(retiredKey);
    const currentKey = Wallet.generate();
    // Old behavior (single current key only) would miss this -- proving
    // the bug the fix closes.
    expect(findVaultTrail([att], DESCRIPTOR, currentKey.publicKey)).toBeNull();
    // Fixed behavior: passing the full key history (current + retired)
    // finds it.
    expect(
      findVaultTrail([att], DESCRIPTOR, [currentKey.publicKey, retiredKey.publicKey]),
    ).not.toBeNull();
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

describe('diagnoseVaultTrail', () => {
  it('reports none_held on empty holdings', () => {
    const wallet = Wallet.generate();
    expect(diagnoseVaultTrail([], DESCRIPTOR, wallet.publicKey)).toEqual({ reason: 'none_held' });
  });

  it('reports descriptor_mismatch and lists the held descriptor(s) -- the recompiled-vault case', () => {
    const wallet = Wallet.generate();
    const staleDescriptor = 'tr_multileaf(old-version)';
    const att = membershipAttestation(wallet, { vaultDescriptor: staleDescriptor });
    const diagnosis = diagnoseVaultTrail([att], DESCRIPTOR, wallet.publicKey);
    expect(diagnosis.reason).toBe('descriptor_mismatch');
    expect(diagnosis.heldDescriptors).toEqual([staleDescriptor]);
  });

  it('reports not_signed_by_me when the descriptor matches but the signer is someone else', () => {
    const issuer = Wallet.generate();
    const me = Wallet.generate();
    const att = membershipAttestation(issuer);
    // Sanity check this is genuinely the "no trail" case first.
    expect(findVaultTrail([att], DESCRIPTOR, me.publicKey)).toBeNull();
    expect(diagnoseVaultTrail([att], DESCRIPTOR, me.publicKey)).toEqual({ reason: 'not_signed_by_me' });
  });

  it('reports invalid_signature for a held, descriptor-matching record that fails its own signature check', () => {
    const wallet = Wallet.generate();
    const att = membershipAttestation(wallet);
    // Corrupt the signature bytes only -- claim/fields stay intact (so
    // isVaultMembership/readVaultMembership still parse it as this vault's
    // membership) but verifyEnvelope's digest check now fails, simulating
    // a corrupted or hand-edited held record.
    const tampered = {
      ...att,
      signatures: att.signatures.map((s) => ({ ...s, sig: '00'.repeat(64) })),
    };
    expect(findVaultTrail([tampered], DESCRIPTOR, wallet.publicKey)).toBeNull();
    expect(diagnoseVaultTrail([tampered], DESCRIPTOR, wallet.publicKey)).toEqual({ reason: 'invalid_signature' });
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
