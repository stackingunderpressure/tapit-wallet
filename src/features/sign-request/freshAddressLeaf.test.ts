import { describe, it, expect, vi } from 'vitest';

// acceptVaultMembership queues anchoring in IndexedDB, which the test
// environment lacks -- same stand-in as acceptVaultMembership.test.ts.
const store = new Map<string, unknown>();
vi.mock('../../shared/lib/idb.ts', () => ({
  idb: {
    get: async <T>(key: string): Promise<T | undefined> => store.get(key) as T | undefined,
    put: async (key: string, value: unknown): Promise<void> => { store.set(key, value); },
    delete: async (key: string): Promise<void> => { store.delete(key); },
  },
}));
import { Wallet } from 'tapit-attest';
import {
  parsePsbt,
  toHex,
  verifyTapScriptSig,
} from '@dynastytrust/bip341-psbt-signer';
import { signPsbtCosign, PsbtCosignError } from './signPsbtCosign.ts';
import { checkRangedKeys, deriveXOnly, isFreshAddressLeaf, type RangedKey } from './freshAddressLeaf.ts';
import { acceptVaultMembership } from './acceptVaultMembership.ts';
import type { PsbtCosignSignRequest } from './types.ts';
import fixture from './fixtures/fresh-address-vault.json';

// A REAL fresh-address vault and spend, made by DynastyTrust's compiler wasm
// and its server spend builder (fixtures/fresh-address-vault.json, see its
// note): path "everyday" is 1-of-2 [this Tapit key, an xpub key], and the
// spend combines coins on receive/0, receive/5 and change/2 -- the case
// that was refused on the operator's phone on 2026-11-24.

function walletOfFixture(): Wallet {
  return Wallet.fromKeypair({ privateKey: fixture.tapit_private_key, publicKey: fixture.tapit_public_key });
}

function membership(wallet: Wallet, rangedKeys?: RangedKey[]) {
  return wallet.attest({
    kind: 'agreement',
    tier: 'high_stakes',
    subject: fixture.vault_descriptor,
    fields: {
      agreement_type: 'vault-membership',
      vault_descriptor: fixture.vault_descriptor,
      vault_name: 'My Vault',
      role: 'everyday',
      leaf_scripts: JSON.stringify(fixture.leaf_scripts),
      ...(rangedKeys ? { ranged_keys: JSON.stringify(rangedKeys) } : {}),
    },
  });
}

function request(psbtHex: string = fixture.psbt_hex): PsbtCosignSignRequest {
  return {
    v: 1,
    intent: 'psbt-cosign',
    origin: 'DynastyTrust',
    callback: 'https://dynastytrust.family/cb',
    psbt_hex: psbtHex,
    vault_context: { vault_descriptor: fixture.vault_descriptor, vault_name: 'My Vault' },
  };
}

describe('fresh-address vault co-signing', () => {
  it('the fixture key really is the xpub at the first address', () => {
    const [k] = fixture.ranged_keys;
    expect(deriveXOnly(k!.xpub, 0, 0)).toBe(k!.key00);
  });

  it('BEFORE: a membership without xpubs signs only the first-address coin (the refusal on the phone, for the others)', () => {
    const wallet = walletOfFixture();
    const signed = parsePsbt(signPsbtCosign(wallet, [membership(wallet)], request(), true));
    // Which address each input is, from its own derivation path (branch/index).
    const at = signed.inputs.map((i) => i.tapBip32Derivation![0]!.path.slice(-2).join('/'));
    const signedAt = signed.inputs.flatMap((i, n) => ((i.tapScriptSigs ?? []).length ? [at[n]] : []));
    expect(at.sort()).toEqual(['0/0', '0/5', '1/2']);
    expect(signedAt).toEqual(['0/0']);
  });

  it('signs every input -- receive/0, receive/5 and change/2 -- with valid signatures once the membership carries the xpub', () => {
    const wallet = walletOfFixture();
    const signed = parsePsbt(signPsbtCosign(wallet, [membership(wallet, fixture.ranged_keys)], request(), true));
    const original = parsePsbt(fixture.psbt_hex);
    signed.inputs.forEach((inp, i) => {
      const sigs = inp.tapScriptSigs ?? [];
      expect(sigs.length, `input ${i}`).toBe(1);
      expect(toHex(sigs[0]!.pubkey)).toBe(fixture.tapit_public_key);
      // Verified against the PSBT as DynastyTrust built it, with its own leaves.
      expect(verifyTapScriptSig(original, i, sigs[0]!, original.inputs[i]!.tapLeafScript!)).toBe(true);
    });
  });

  it('refuses when the membership names a different xpub for the key', () => {
    const wallet = walletOfFixture();
    const forged = [{ xpub: fixture.wrong_xpub, key00: fixture.ranged_keys[0]!.key00 }];
    expect(() => signPsbtCosign(wallet, [membership(wallet, forged)], request(), true)).toThrow(/does not match/);
  });

  it('refuses a script at an address the PSBT does not name (indexes moved)', () => {
    const parsed = parsePsbt(fixture.psbt_hex);
    const inp = parsed.inputs.find((i) => i.tapBip32Derivation![0]!.path.slice(-2).join('/') === '0/5')!;
    const shifted = inp.tapBip32Derivation!.map((d) => ({ ...d, path: [...d.path.slice(0, -1), 6] }));
    expect(isFreshAddressLeaf(inp.tapLeafScript![0]!.script, fixture.leaf_scripts, fixture.ranged_keys, shifted)).toBe(false);
    expect(isFreshAddressLeaf(inp.tapLeafScript![0]!.script, fixture.leaf_scripts, fixture.ranged_keys, inp.tapBip32Derivation)).toBe(true);
  });

  it('refuses an index past the cap and a branch that is not receive or change', () => {
    const parsed = parsePsbt(fixture.psbt_hex);
    const inp = parsed.inputs.find((i) => i.tapBip32Derivation![0]!.path.slice(-2).join('/') === '0/5')!;
    const far = inp.tapBip32Derivation!.map((d) => ({ ...d, path: [...d.path.slice(0, -2), 0, 100_001] }));
    const odd = inp.tapBip32Derivation!.map((d) => ({ ...d, path: [...d.path.slice(0, -2), 2, 5] }));
    expect(isFreshAddressLeaf(inp.tapLeafScript![0]!.script, fixture.leaf_scripts, fixture.ranged_keys, far)).toBe(false);
    expect(isFreshAddressLeaf(inp.tapLeafScript![0]!.script, fixture.leaf_scripts, fixture.ranged_keys, odd)).toBe(false);
  });

  it('a key that appears in none of the vault scripts is refused', () => {
    expect(() => checkRangedKeys(fixture.ranged_keys, ['20' + '11'.repeat(32) + 'ac'])).toThrow(/does not appear/);
  });

  it('accepting a membership checks the xpubs first, and stores them', async () => {
    const wallet = walletOfFixture();
    const base = {
      v: 1 as const, vault_descriptor: fixture.vault_descriptor, vault_name: 'My Vault', role: 'everyday',
      leaf_scripts: fixture.leaf_scripts,
    };
    await expect(acceptVaultMembership(wallet, 'owner', { ...base, ranged_keys: [{ xpub: fixture.wrong_xpub, key00: fixture.ranged_keys[0]!.key00 }] }, async () => {}, null))
      .rejects.toThrow(/does not match/);
    const att = await acceptVaultMembership(wallet, 'owner', { ...base, ranged_keys: fixture.ranged_keys }, async () => {}, null);
    const signed = parsePsbt(signPsbtCosign(wallet, [att], request(), true));
    expect(signed.inputs.every((i) => (i.tapScriptSigs ?? []).length === 1)).toBe(true);
  });

  it('still refuses a script of another vault even with xpubs present', () => {
    const wallet = walletOfFixture();
    const other = wallet.attest({
      kind: 'agreement', tier: 'high_stakes', subject: fixture.vault_descriptor,
      fields: {
        agreement_type: 'vault-membership', vault_descriptor: fixture.vault_descriptor, vault_name: 'x', role: 'everyday',
        leaf_scripts: JSON.stringify(['20' + fixture.tapit_public_key + 'ac']),
      },
    });
    expect(() => signPsbtCosign(wallet, [other], request(), true)).toThrow(PsbtCosignError);
  });
});
