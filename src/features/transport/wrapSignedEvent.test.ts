import { describe, expect, it } from 'vitest';
import { Wallet, decryptFrom, generateKeypair } from 'tapit-attest';
import { buildEvent, verifyEvent, type TransportEvent } from './nostrEvent.ts';
import { wrapSignedEvent } from './nip17.ts';

async function signedAnswer(wallet: Wallet, to: string): Promise<TransportEvent> {
  return buildEvent({
    pubkey: wallet.publicKey,
    sign: (d) => wallet.signDigest(d),
    kind: 9579,
    content: wallet.nip44EncryptTo('{"v":1,"psbt_hex":"00"}', to),
    tags: [['p', to]],
  });
}

describe('wrapSignedEvent (Phase 1: answers to DynastyTrust)', () => {
  it('hides the wallet key and blurs the time; the recipient gets back the exact signed answer', async () => {
    const wallet = Wallet.generate();
    const reply = generateKeypair();
    const inner = await signedAnswer(wallet, reply.publicKey);
    const wrap = await wrapSignedEvent(inner, reply.publicKey, wallet);
    expect(wrap.kind).toBe(1059);
    expect(await verifyEvent(wrap)).toBe(true);
    expect(wrap.pubkey).not.toBe(wallet.publicKey);
    expect(JSON.stringify(wrap)).not.toContain(wallet.publicKey);
    expect(wrap.tags).toEqual([['p', reply.publicKey]]);
    const now = Math.floor(Date.now() / 1000);
    expect(wrap.created_at).toBeLessThanOrEqual(now);
    expect(wrap.created_at).toBeGreaterThan(now - 2 * 86400 - 5);
    const seal = JSON.parse(decryptFrom(wrap.content, wrap.pubkey, reply.privateKey)) as TransportEvent;
    expect(seal.kind).toBe(13);
    expect(seal.pubkey).toBe(wallet.publicKey);
    expect(await verifyEvent(seal)).toBe(true);
    const back = JSON.parse(decryptFrom(seal.content, seal.pubkey, reply.privateKey)) as TransportEvent;
    expect(back).toEqual(inner);
    expect(await verifyEvent(back)).toBe(true);
  });

  it('every send uses a different throwaway key', async () => {
    const wallet = Wallet.generate();
    const reply = generateKeypair();
    const inner = await signedAnswer(wallet, reply.publicKey);
    const a = await wrapSignedEvent(inner, reply.publicKey, wallet);
    const b = await wrapSignedEvent(inner, reply.publicKey, wallet);
    expect(a.pubkey).not.toBe(b.pubkey);
  });

  it('refuses to wrap an event signed by someone else', async () => {
    const wallet = Wallet.generate();
    const other = Wallet.generate();
    const reply = generateKeypair();
    const inner = await signedAnswer(other, reply.publicKey);
    await expect(wrapSignedEvent(inner, reply.publicKey, wallet)).rejects.toThrow(/signed by the sending wallet/);
  });
});
