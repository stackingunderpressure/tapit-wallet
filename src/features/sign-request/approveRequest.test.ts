import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Wallet, decryptFrom } from 'tapit-attest';
import { schnorr } from '@noble/curves/secp256k1';
import { fromHex, toHex, varint } from '@dynastytrust/bip341-psbt-signer';
import { approveSignRequest, buildSignedTransactionJournalFields } from './approveRequest.ts';
import type { PsbtCosignSignRequest } from './types.ts';
import type {
  Transport,
  TransportEventHandler,
  Subscription,
  PublishResult,
  RelayStatus,
  RelayStatusHandler,
} from '../transport/transport.ts';
import type { TransportEvent } from '../transport/nostrEvent.ts';

// Two suites in this one file. First: Cut B3 slice 2 -- the branch that
// decides whether a signed psbt-cosign response redirects (the original
// B2 deeplink contract, unchanged) or publishes back over Nostr (new).
// No existing test covered approveRequest.ts's orchestration directly
// before this -- its sub-pieces (signPsbtCosign, coSignEnvelope) were
// tested in isolation instead -- but this specific branch is new control
// flow worth locking in on its own. Second (2026-08-13, operator: "every
// transaction you sign should be logged as an attested event"): the
// pure buildSignedTransactionJournalFields helper that builds the
// signed-transaction journal record's fields, unit-tested directly per
// the same "pure builder, side-effecting wrapper" split signPsbtCosign
// .test.ts already uses for the neighboring signing logic.

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

function buildFixturePsbt(xOnlyPubkeyHex: string) {
  const script = concat(fromHex('20'), fromHex(xOnlyPubkeyHex), fromHex('ac'));
  const leafVersion = 0xc0;
  const txid = fromHex('11'.repeat(32));
  const scriptPubkey = concat(new Uint8Array([0x51, 0x20]), fromHex('22'.repeat(32)));
  const rawTx = concat(
    w32(2), varint(1), txid, w32(0), varint(0), w32(0xfffffffd),
    varint(1), w64(100000n), varint(scriptPubkey.length), scriptPubkey, w32(0),
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
  return { psbtHex: toHex(psbtBytes), script };
}

function membershipAttestation(wallet: Wallet, leafScriptHex: string) {
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
    },
  });
}

function baseRequest(psbtHex: string): PsbtCosignSignRequest {
  return {
    v: 1,
    intent: 'psbt-cosign',
    origin: 'DynastyTrust',
    callback: 'https://dynastytrust.family/vaults',
    psbt_hex: psbtHex,
    vault_context: { vault_descriptor: DESCRIPTOR, vault_name: 'Family Trust' },
  };
}

class FakeTransport implements Transport {
  published: TransportEvent[] = [];
  async publish(event: TransportEvent): Promise<PublishResult> {
    this.published.push(event);
    return { eventId: event.id, dispatched: 1, accepted: ['wss://fake'], rejected: [], pending: [] };
  }
  subscribe(_filter: unknown, _handler: TransportEventHandler): Subscription {
    return { close() {} };
  }
  close(): void {}
  relayStatus(): readonly RelayStatus[] {
    return [];
  }
  subscribeStatus(_handler: RelayStatusHandler): () => void {
    return () => {};
  }
}

describe('approveSignRequest — psbt-cosign response routing', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: { ...originalLocation, href: 'https://wallet.example/sign?req=x' },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: originalLocation,
    });
  });

  it('with no response_channel, redirects via window.location.href (unchanged B2 deeplink behavior)', async () => {
    const wallet = Wallet.generate();
    const { psbtHex, script } = buildFixturePsbt(wallet.publicKey);
    const trail = membershipAttestation(wallet, toHex(script));
    await wallet.hold(trail);
    const transport = new FakeTransport();

    const result = await approveSignRequest(
      wallet, 'owner-1', baseRequest(psbtHex), async () => {}, null, true, transport,
    );

    expect(result).toEqual({ delivered: 'redirect' });
    expect(window.location.href).toContain('https://dynastytrust.family/vaults');
    expect(window.location.href).toContain('grant=');
    expect(transport.published).toHaveLength(0);
  });

  it('with a response_channel, publishes the signed PSBT back over Nostr instead of redirecting', async () => {
    const wallet = Wallet.generate();
    const { psbtHex, script } = buildFixturePsbt(wallet.publicKey);
    const trail = membershipAttestation(wallet, toHex(script));
    await wallet.hold(trail);
    const transport = new FakeTransport();

    // Stand-in for DynastyTrust's ephemeral reply keypair.
    const requesterPriv = toHex(crypto.getRandomValues(new Uint8Array(32)));
    const requesterPub = toHex(schnorr.getPublicKey(fromHex(requesterPriv)));

    const request: PsbtCosignSignRequest = {
      ...baseRequest(psbtHex),
      response_channel: { kind: 'nostr', requester_pubkey: requesterPub },
    };
    const hrefBefore = window.location.href;

    const result = await approveSignRequest(
      wallet, 'owner-1', request, async () => {}, null, true, transport,
    );

    expect(result).toEqual({ delivered: 'nostr' });
    expect(window.location.href).toBe(hrefBefore); // never touched
    expect(transport.published).toHaveLength(1);

    const event = transport.published[0]!;
    expect(event.kind).toBe(9579);
    expect(event.pubkey).toBe(wallet.publicKey); // sent as the wallet's OWN real identity
    expect(event.tags).toContainEqual(['p', requesterPub]);

    // Proof, not just "didn't throw": decrypt as the requester would and
    // confirm the payload actually carries the signed PSBT.
    const plaintext = decryptFrom(event.content, wallet.publicKey, requesterPriv);
    const payload = JSON.parse(plaintext) as { v: number; psbt_hex: string };
    expect(payload.v).toBe(1);
    expect(payload.psbt_hex).not.toBe(psbtHex); // the signed hex differs from the unsigned input
    expect(payload.psbt_hex.length).toBeGreaterThan(0);
  });

  it('with a response_channel but no transport passed, still returns delivered:"nostr" without throwing', async () => {
    const wallet = Wallet.generate();
    const { psbtHex, script } = buildFixturePsbt(wallet.publicKey);
    const trail = membershipAttestation(wallet, toHex(script));
    await wallet.hold(trail);

    const request: PsbtCosignSignRequest = {
      ...baseRequest(psbtHex),
      response_channel: { kind: 'nostr', requester_pubkey: '11'.repeat(32) },
    };

    const result = await approveSignRequest(wallet, 'owner-1', request, async () => {}, null, true, null);
    expect(result).toEqual({ delivered: 'nostr' });
  });
});

describe('buildSignedTransactionJournalFields', () => {
  // A one-input, one-output PSBT with a deliberately NON-palindromic txid
  // (ascending bytes 01..20), unlike buildFixturePsbt's above's symmetric
  // all-0x11 txid -- a byte-order bug in the journal-field builder can't
  // hide behind a fixture where reversal is a no-op.
  function buildJournalFieldsFixturePsbt() {
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

  function journalTestRequest(psbtHex: string, vaultName?: string): PsbtCosignSignRequest {
    return {
      v: 1,
      intent: 'psbt-cosign',
      origin: 'DynastyTrust',
      callback: 'https://dynastytrust.family/cb',
      psbt_hex: psbtHex,
      vault_context: { vault_descriptor: DESCRIPTOR, ...(vaultName ? { vault_name: vaultName } : {}) },
    };
  }

  it('reverses the wire-order txid to the conventional display order', () => {
    const fx = buildJournalFieldsFixturePsbt();
    const fields = buildSignedTransactionJournalFields(journalTestRequest(fx.psbtHex));
    const inputs = JSON.parse(fields.inputs!) as Array<{ txid: string; vout: number }>;
    expect(inputs).toEqual([{ txid: fx.expectedDisplayTxid, vout: fx.vout }]);
    // Sanity: the reversed txid must NOT equal the raw wire-order bytes
    // for this fixture (it's deliberately non-palindromic) -- catches a
    // no-op "reversal" that silently returns the input unchanged.
    expect(fields.inputs).not.toContain(fx.expectedDisplayTxid.split('').reverse().join(''));
  });

  it('records the real output amount and scriptPubkey, independent of vault_context', () => {
    const fx = buildJournalFieldsFixturePsbt();
    const fields = buildSignedTransactionJournalFields(journalTestRequest(fx.psbtHex));
    const outputs = JSON.parse(fields.outputs!) as Array<{ amount_sats: string; scriptpubkey_hex: string }>;
    expect(outputs).toEqual([{ amount_sats: fx.outAmount.toString(), scriptpubkey_hex: fx.scriptPubkeyHex }]);
    expect(fields.total_out_sats).toBe(fx.outAmount.toString());
    expect(fields.input_count).toBe('1');
    expect(fields.output_count).toBe('1');
  });

  it('carries the vault descriptor and, when present, the vault name', () => {
    const fx = buildJournalFieldsFixturePsbt();
    const fields = buildSignedTransactionJournalFields(journalTestRequest(fx.psbtHex, 'Family Trust'));
    expect(fields.category).toBe('Bitcoin');
    expect(fields.source).toBe('psbt-cosign-signature');
    expect(fields.vault_descriptor).toBe(DESCRIPTOR);
    expect(fields.vault_name).toBe('Family Trust');
    expect(fields.text).toContain('Family Trust');
    expect(fields.text).toContain(fx.outAmount.toString());
    expect(() => new Date(fields.written_at!).toISOString()).not.toThrow();
  });

  it('omits vault_name entirely when the request did not supply one', () => {
    const fx = buildJournalFieldsFixturePsbt();
    const fields = buildSignedTransactionJournalFields(journalTestRequest(fx.psbtHex));
    expect(fields.vault_name).toBeUndefined();
    expect(fields.text).toContain(DESCRIPTOR);
  });
});
