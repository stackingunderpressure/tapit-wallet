import { describe, it, expect } from 'vitest';
import { Wallet } from 'tapit-attest';
import { schnorr } from '@noble/curves/secp256k1';
import {
  fromHex,
  toHex,
  varint,
  parsePsbt,
  tapLeafHash,
  tapscriptSighash,
} from '@dynastytrust/bip341-psbt-signer';
import { signPsbtCosign, PsbtCosignError } from './signPsbtCosign.ts';
import type { PsbtCosignSignRequest } from './types.ts';

const DESCRIPTOR = 'tr_multileaf(...)';

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}
function w32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = n & 0xff;
  b[1] = (n >> 8) & 0xff;
  b[2] = (n >> 16) & 0xff;
  b[3] = (n >> 24) & 0xff;
  return b;
}
function w64(n: bigint): Uint8Array {
  const b = new Uint8Array(8);
  for (let i = 0; i < 8; i++) b[i] = Number((n >> BigInt(8 * i)) & 0xffn);
  return b;
}
function kv(key: Uint8Array, value: Uint8Array): Uint8Array {
  return concat(varint(key.length), key, varint(value.length), value);
}

/**
 * Build a one-input, one-output PSBT whose sole taproot leaf script is
 * `<xOnlyPubkeyHex> OP_CHECKSIG` (0x20 <32 bytes> 0xac) -- a real,
 * minimal, verifiable script this specific key can sign for.
 */
function buildFixturePsbt(xOnlyPubkeyHex: string) {
  const script = concat(fromHex('20'), fromHex(xOnlyPubkeyHex), fromHex('ac'));
  const leafVersion = 0xc0;
  const txid = fromHex('11'.repeat(32));
  const scriptPubkey = concat(new Uint8Array([0x51, 0x20]), fromHex('22'.repeat(32)));

  const rawTx = concat(
    w32(2),
    varint(1),
    txid,
    w32(0),
    varint(0),
    w32(0xfffffffd),
    varint(1),
    w64(100000n),
    varint(scriptPubkey.length),
    scriptPubkey,
    w32(0),
  );
  const witnessUtxoValue = concat(w64(150000n), varint(scriptPubkey.length), scriptPubkey);
  const controlBlock = fromHex('c0' + '33'.repeat(32));
  const tapLeafScriptKey = concat(new Uint8Array([0x15]), controlBlock);
  const tapLeafScriptValue = concat(script, new Uint8Array([leafVersion]));

  const psbtBytes = concat(
    fromHex('70736274ff'),
    kv(new Uint8Array([0x00]), rawTx),
    new Uint8Array([0x00]),
    kv(new Uint8Array([0x01]), witnessUtxoValue),
    kv(tapLeafScriptKey, tapLeafScriptValue),
    new Uint8Array([0x00]),
    new Uint8Array([0x00]),
  );
  return { psbtHex: toHex(psbtBytes), script, leafVersion };
}

function membershipAttestation(
  wallet: Wallet,
  leafScriptHex: string,
  threshold?: string,
) {
  return wallet.attest({
    kind: 'agreement',
    tier: 'high_stakes',
    subject: DESCRIPTOR,
    fields: {
      agreement_type: 'vault-membership',
      vault_descriptor: DESCRIPTOR,
      vault_name: 'Family Trust',
      role: 'founder',
      leaf_scripts: JSON.stringify([leafScriptHex]),
      ...(threshold !== undefined ? { high_value_threshold_sats: threshold } : {}),
    },
  });
}

function baseRequest(psbtHex: string): PsbtCosignSignRequest {
  return {
    v: 1,
    intent: 'psbt-cosign',
    origin: 'DynastyTrust',
    callback: 'https://dynastytrust.family/cb',
    psbt_hex: psbtHex,
    vault_context: { vault_descriptor: DESCRIPTOR, vault_name: 'Family Trust' },
  };
}

describe('signPsbtCosign', () => {
  it('refuses when the wallet holds no matching vault-membership trail', () => {
    const wallet = Wallet.generate();
    const { psbtHex } = buildFixturePsbt(wallet.publicKey);
    expect(() => signPsbtCosign(wallet, [], baseRequest(psbtHex), true)).toThrow(
      PsbtCosignError,
    );
    try {
      signPsbtCosign(wallet, [], baseRequest(psbtHex), true);
    } catch (err) {
      expect(err).toBeInstanceOf(PsbtCosignError);
      expect((err as PsbtCosignError).code).toBe('no_vault_trail');
    }
  });

  it('refuses a high-value spend (no threshold declared = fail-closed) without the callback confirmed', () => {
    const wallet = Wallet.generate();
    const { psbtHex, script } = buildFixturePsbt(wallet.publicKey);
    const trail = membershipAttestation(wallet, toHex(script));
    try {
      signPsbtCosign(wallet, [trail], baseRequest(psbtHex), false);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PsbtCosignError);
      expect((err as PsbtCosignError).code).toBe('callback_required');
    }
  });

  it('refuses a leaf script the trail does not know about, even with a matching vault_descriptor', () => {
    const wallet = Wallet.generate();
    const { psbtHex } = buildFixturePsbt(wallet.publicKey);
    // Membership names some OTHER leaf script, not the one in this PSBT.
    const trail = membershipAttestation(wallet, 'deadbeef');
    try {
      signPsbtCosign(wallet, [trail], baseRequest(psbtHex), true);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PsbtCosignError);
      expect((err as PsbtCosignError).code).toBe('unknown_leaf_script');
    }
  });

  it('signs a recognized leaf once the trail exists and the callback is confirmed, producing a valid Schnorr signature', () => {
    const wallet = Wallet.generate();
    const { psbtHex, script, leafVersion } = buildFixturePsbt(wallet.publicKey);
    const trail = membershipAttestation(wallet, toHex(script));

    const signedHex = signPsbtCosign(wallet, [trail], baseRequest(psbtHex), true);
    const reparsed = parsePsbt(signedHex);
    const sigs = reparsed.inputs[0]?.tapScriptSigs ?? [];
    expect(sigs.length).toBe(1);
    const [sig] = sigs;
    if (!sig) throw new Error('unreachable — length checked above');
    expect(toHex(sig.pubkey)).toBe(wallet.publicKey.toLowerCase());

    // Cryptographic proof, not just "didn't throw": the signature verifies
    // against the exact BIP341 sighash for this leaf and this key.
    const leafHash = tapLeafHash(script, leafVersion);
    const expectedSighash = tapscriptSighash(parsePsbt(psbtHex), 0, leafHash, 0x00);
    expect(schnorr.verify(sig.sig, expectedSighash, fromHex(wallet.publicKey))).toBe(true);
  });

  it('below the declared threshold, no callback confirmation is required', () => {
    const wallet = Wallet.generate();
    const { psbtHex, script } = buildFixturePsbt(wallet.publicKey);
    // Fixture PSBT totals 100000 sats out; declare a threshold above that.
    const trail = membershipAttestation(wallet, toHex(script), '1000000');

    const signedHex = signPsbtCosign(wallet, [trail], baseRequest(psbtHex), false);
    const reparsed = parsePsbt(signedHex);
    expect(reparsed.inputs[0]?.tapScriptSigs?.length).toBe(1);
  });
});
