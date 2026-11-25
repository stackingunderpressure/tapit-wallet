import { describe, expect, it } from 'vitest';
import { Wallet } from 'tapit-attest';
import { parsePsbt } from '@dynastytrust/bip341-psbt-signer';
import { signPsbtCosign, PsbtCosignError } from './signPsbtCosign.ts';
import { readVaultMembership, requiresCallbackConfirmation } from './vaultTrail.ts';
import { changeProblem, spendOutputs } from './spendOutputs.ts';
import { offerKey, heldCoversRequest } from './membershipOffer.ts';
import { isVaultMembershipRequestPayload } from './vaultMembershipChannel.ts';
import type { PsbtCosignSignRequest } from './types.ts';
import fixture from './fixtures/fresh-address-vault.json';

// The change-address check and the per-member review mode (DynastyTrust
// docs/tapit-review-modes-build-note.md; operator, 2026-11-24: "Build the
// Tapit change-address check next / And also option for a vault builder to
// choose blind transactions and only need the wellness check part of
// relationship. Both options available"). The spend is a real one from
// DynastyTrust's builder: its change goes to the vault's change address 3.

const wallet = () => Wallet.fromKeypair({ privateKey: fixture.tapit_private_key, publicKey: fixture.tapit_public_key });
function membership(w: Wallet, extra: Record<string, string> = {}) {
  return w.attest({
    kind: 'agreement', tier: 'high_stakes', subject: fixture.vault_descriptor,
    fields: {
      agreement_type: 'vault-membership', vault_descriptor: fixture.vault_descriptor, vault_name: 'My Vault', role: 'everyday',
      leaf_scripts: JSON.stringify(fixture.leaf_scripts), ranged_keys: JSON.stringify(fixture.ranged_keys), ...extra,
    },
  });
}
const request = (): PsbtCosignSignRequest => ({
  v: 1, intent: 'psbt-cosign', origin: 'DynastyTrust', callback: 'https://dynastytrust.family/cb',
  psbt_hex: fixture.psbt_hex, vault_context: { vault_descriptor: fixture.vault_descriptor, vault_name: 'My Vault' },
});

describe('change-address check', () => {
  it('the spend marks exactly one output as the vault change, and it is change address 3', () => {
    const outs = spendOutputs(parsePsbt(fixture.psbt_hex), fixture.change_scripts);
    expect(outs.filter((o) => o.claimsVault).length).toBe(1);
    expect(outs.find((o) => o.claimsVault)!.scriptHex).toBe(fixture.change_scripts[3]);
    expect(outs.find((o) => o.claimsVault)!.backToVault).toBe(true);
  });

  it('signs when the change is one of the vault change addresses in the membership', () => {
    const w = wallet();
    const signed = parsePsbt(signPsbtCosign(w, [membership(w, { change_scripts: JSON.stringify(fixture.change_scripts) })], request(), true));
    expect(signed.inputs.every((i) => (i.tapScriptSigs ?? []).length === 1)).toBe(true);
  });

  it('refuses, before any signature, when the "change" is not one of them', () => {
    const w = wallet();
    const m = membership(w, { change_scripts: JSON.stringify(fixture.receive_scripts) });
    expect(changeProblem(parsePsbt(fixture.psbt_hex), fixture.receive_scripts)).toMatch(/not one of the vault's own addresses/);
    try {
      signPsbtCosign(w, [m], request(), true);
      expect.unreachable('should have refused');
    } catch (e) {
      expect(e).toBeInstanceOf(PsbtCosignError);
      expect((e as PsbtCosignError).code).toBe('change_not_vault');
    }
  });

  it('a membership from before (no change list) keeps signing -- the operator chose this until resent', () => {
    const w = wallet();
    const signed = parsePsbt(signPsbtCosign(w, [membership(w)], request(), true));
    expect(signed.inputs.every((i) => (i.tapScriptSigs ?? []).length === 1)).toBe(true);
  });
});

describe('review mode', () => {
  it('defaults to wellness; full is read from the signed membership', () => {
    const w = wallet();
    expect(readVaultMembership(membership(w)).reviewMode).toBe('wellness');
    expect(readVaultMembership(membership(w, { review_mode: 'full', network: 'signet' })).reviewMode).toBe('full');
    expect(readVaultMembership(membership(w, { review_mode: 'anything' })).reviewMode).toBe('wellness');
  });

  it('the request guard accepts the new fields and refuses malformed ones', () => {
    const base = { v: 1, vault_descriptor: 'd', vault_name: 'n', role: 'everyday', leaf_scripts: fixture.leaf_scripts };
    expect(isVaultMembershipRequestPayload({ ...base, review_mode: 'full', change_scripts: fixture.change_scripts, network: 'signet' })).toBe(true);
    expect(isVaultMembershipRequestPayload({ ...base, review_mode: 'peek' })).toBe(false);
    expect(isVaultMembershipRequestPayload({ ...base, change_scripts: ['ZZ'] })).toBe(false);
    expect(isVaultMembershipRequestPayload({ ...base, change_scripts: Array(251).fill(fixture.change_scripts[0]) })).toBe(false);
    expect(isVaultMembershipRequestPayload({ ...base, network: 'mainnet' })).toBe(false);
  });

  it('switching a member to full, or a new change list, is a new offer; the same offer again is not', () => {
    const a = offerKey('d', 'r', { reviewMode: 'wellness' });
    expect(offerKey('d', 'r', { reviewMode: 'full' })).not.toBe(a);
    expect(offerKey('d', 'r', { changeScripts: fixture.change_scripts })).not.toBe(a);
    expect(offerKey('d', 'r', { changeScripts: fixture.change_scripts })).toBe(offerKey('d', 'r', { changeScripts: [...fixture.change_scripts].reverse() }));
    expect(heldCoversRequest({ reviewMode: 'wellness' }, { reviewMode: 'full' })).toBe(false);
    expect(heldCoversRequest({ reviewMode: 'full' }, { reviewMode: 'wellness' })).toBe(false);
    expect(heldCoversRequest({ changeScripts: fixture.change_scripts.slice(0, 5) }, { changeScripts: fixture.change_scripts })).toBe(false);
    expect(heldCoversRequest({ reviewMode: 'full', changeScripts: fixture.change_scripts }, { reviewMode: 'full', changeScripts: fixture.change_scripts })).toBe(true);
  });
});

// A wellness-check path designed into the vault (DynastyTrust
// docs/wellness-group-build-note.md; operator, 2026-11-25).
describe('wellness-check path', () => {
  it('asks the safety phrase on every spend, even below the live-check amount', () => {
    const w = wallet();
    const normal = membership(w, { high_value_threshold_sats: '1000000' });
    const checker = membership(w, { high_value_threshold_sats: '1000000', wellness_path: 'true' });
    expect(requiresCallbackConfirmation(normal, 9_810n)).toBe(false);
    expect(requiresCallbackConfirmation(checker, 9_810n)).toBe(true);
    expect(readVaultMembership(checker).wellnessPath).toBe(true);
  });

  it('the request carries it, and joining a wellness path is a new offer', () => {
    const base = { v: 1, vault_descriptor: 'd', vault_name: 'n', role: 'wellness', leaf_scripts: fixture.leaf_scripts };
    expect(isVaultMembershipRequestPayload({ ...base, wellness_path: true })).toBe(true);
    expect(isVaultMembershipRequestPayload({ ...base, wellness_path: 'yes' })).toBe(false);
    expect(offerKey('d', 'r', { wellnessPath: true })).not.toBe(offerKey('d', 'r', {}));
    expect(heldCoversRequest({}, { wellnessPath: true })).toBe(false);
    expect(heldCoversRequest({ wellnessPath: true }, { wellnessPath: true })).toBe(true);
  });
});
