import { describe, it, expect } from 'vitest';
import { fromHex, toHex, varint } from '@dynastytrust/bip341-psbt-signer';
import { buildSignedTransactionJournalFields } from './approveRequest.ts';
import type { PsbtCosignSignRequest } from './types.ts';

// Operator directive (2026-08-13): "every transaction you sign should be
// logged as an attested event." This is the pure half of that cut --
// building the journal-attestation fields from a psbt-cosign request --
// unit-tested directly per the same "pure builder, side-effecting
// wrapper" split signPsbtCosign.test.ts already uses for the neighboring
// signing logic. The wallet.sign / wallet.hold / anchorQueue side of
// recordSignedTransactionJournalEntry is intentionally NOT covered here
// (no existing precedent in this feature for mocking Wallet + IndexedDB +
// window.location together -- approveRequest.ts as a whole has never had
// its own test file for exactly that reason); this file locks in the one
// part that is genuinely easy to get wrong silently: byte order.

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
 * A one-input, one-output PSBT with a deliberately NON-palindromic txid
 * (ascending bytes 01..20) so a byte-order bug in the journal-field
 * builder can't hide behind a symmetric fixture the way `signPsbtCosign
 * .test.ts`'s all-0x11 txid would.
 */
function buildFixturePsbt() {
  const txidWireOrder = fromHex(
    Array.from({ length: 32 }, (_, i) => (i + 1).toString(16).padStart(2, '0')).join(''),
  );
  const vout = 3;
  const outAmount = 54321n;
  const scriptPubkey = concat(new Uint8Array([0x51, 0x20]), fromHex('22'.repeat(32)));

  const rawTx = concat(
    w32(2),
    varint(1),
    txidWireOrder,
    w32(vout),
    varint(0),
    w32(0xfffffffd),
    varint(1),
    w64(outAmount),
    varint(scriptPubkey.length),
    scriptPubkey,
    w32(0),
  );
  const witnessUtxoValue = concat(w64(150000n), varint(scriptPubkey.length), scriptPubkey);

  const psbtBytes = concat(
    fromHex('70736274ff'),
    kv(new Uint8Array([0x00]), rawTx),
    new Uint8Array([0x00]),
    kv(new Uint8Array([0x01]), witnessUtxoValue),
    new Uint8Array([0x00]),
    new Uint8Array([0x00]),
  );

  return {
    psbtHex: toHex(psbtBytes),
    vout,
    outAmount,
    scriptPubkeyHex: toHex(scriptPubkey),
    expectedDisplayTxid: toHex(Uint8Array.from(txidWireOrder).reverse()),
  };
}

function baseRequest(psbtHex: string, vaultName?: string): PsbtCosignSignRequest {
  return {
    v: 1,
    intent: 'psbt-cosign',
    origin: 'DynastyTrust',
    callback: 'https://dynastytrust.family/cb',
    psbt_hex: psbtHex,
    vault_context: { vault_descriptor: DESCRIPTOR, ...(vaultName ? { vault_name: vaultName } : {}) },
  };
}

describe('buildSignedTransactionJournalFields', () => {
  it('reverses the wire-order txid to the conventional display order', () => {
    const fx = buildFixturePsbt();
    const fields = buildSignedTransactionJournalFields(baseRequest(fx.psbtHex));
    const inputs = JSON.parse(fields.inputs!) as Array<{ txid: string; vout: number }>;
    expect(inputs).toEqual([{ txid: fx.expectedDisplayTxid, vout: fx.vout }]);
    // Sanity: the reversed txid must NOT equal the raw wire-order bytes
    // for this fixture (it's deliberately non-palindromic) -- catches a
    // no-op "reversal" that silently returns the input unchanged.
    expect(fields.inputs).not.toContain(fx.expectedDisplayTxid.split('').reverse().join(''));
  });

  it('records the real output amount and scriptPubkey, independent of vault_context', () => {
    const fx = buildFixturePsbt();
    const fields = buildSignedTransactionJournalFields(baseRequest(fx.psbtHex));
    const outputs = JSON.parse(fields.outputs!) as Array<{ amount_sats: string; scriptpubkey_hex: string }>;
    expect(outputs).toEqual([{ amount_sats: fx.outAmount.toString(), scriptpubkey_hex: fx.scriptPubkeyHex }]);
    expect(fields.total_out_sats).toBe(fx.outAmount.toString());
    expect(fields.input_count).toBe('1');
    expect(fields.output_count).toBe('1');
  });

  it('carries the vault descriptor and, when present, the vault name', () => {
    const fx = buildFixturePsbt();
    const fields = buildSignedTransactionJournalFields(baseRequest(fx.psbtHex, 'Family Trust'));
    expect(fields.category).toBe('Bitcoin');
    expect(fields.source).toBe('psbt-cosign-signature');
    expect(fields.vault_descriptor).toBe(DESCRIPTOR);
    expect(fields.vault_name).toBe('Family Trust');
    expect(fields.text).toContain('Family Trust');
    expect(fields.text).toContain(fx.outAmount.toString());
    expect(() => new Date(fields.written_at!).toISOString()).not.toThrow();
  });

  it('omits vault_name entirely when the request did not supply one', () => {
    const fx = buildFixturePsbt();
    const fields = buildSignedTransactionJournalFields(baseRequest(fx.psbtHex));
    expect(fields.vault_name).toBeUndefined();
    expect(fields.text).toContain(DESCRIPTOR);
  });
});
