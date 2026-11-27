import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// jsdom has no IndexedDB: same idb stand-in as acceptVaultMembership.test.ts.
const store = new Map<string, unknown>();
vi.mock('../../shared/lib/idb.ts', () => ({
  idb: {
    get: async <T>(key: string): Promise<T | undefined> => store.get(key) as T | undefined,
    put: async (key: string, value: unknown): Promise<void> => {
      store.set(key, value);
    },
    delete: async (key: string): Promise<void> => {
      store.delete(key);
    },
  },
}));
import { Wallet, decryptFrom, encryptTo, verifyEnvelope, type Attestation } from 'tapit-attest';
import { schnorr } from '@noble/curves/secp256k1';
import { parseSignRequest } from './parseSignRequest.ts';
import { readRecordRequest, subscribeRecordRequests, RECORD_REQUEST_KIND, type InboxRecordRequest } from './recordRequestChannel.ts';
import { RECORD_RESPONSE_KIND } from './recordResponseChannel.ts';
import { approveSignRequest } from './approveRequest.ts';
import { buildEvent, type TransportEvent } from '../transport/nostrEvent.ts';
import type { PublishResult, RelayStatus, RelayStatusHandler, Subscription, Transport, TransportEventHandler } from '../transport/transport.ts';

// Record requests over Nostr (operator, 2026-11-27: the redirect reloaded
// Tapit and asked for the passphrase on every Family Bitcoin Game sign).

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
function keypair() {
  const priv = hex(crypto.getRandomValues(new Uint8Array(32)));
  return { priv, pub: hex(schnorr.getPublicKey(priv)) };
}

class FakeTransport implements Transport {
  published: TransportEvent[] = [];
  handlers: TransportEventHandler[] = [];
  async publish(event: TransportEvent): Promise<PublishResult> {
    this.published.push(event);
    return { eventId: event.id, dispatched: 1, accepted: ['wss://fake'], rejected: [], pending: [] };
  }
  subscribe(_filter: unknown, handler: TransportEventHandler): Subscription {
    this.handlers.push(handler);
    return { close() {} };
  }
  close(): void {}
  relayStatus(): readonly RelayStatus[] {
    return [];
  }
  subscribeStatus(_h: RelayStatusHandler): () => void {
    return () => {};
  }
}

const reply = keypair();
const attest = {
  v: 1,
  intent: 'attest',
  origin: 'Family Bitcoin Game',
  callback: 'https://game.example/',
  nonce: 'fbg:sign:5:p21:ab',
  kind: 'meta',
  tier: 'routine',
  subject: 'me',
  fields: { action: 'I got back in with my family’s help' },
  response_channel: { kind: 'nostr', requester_pubkey: reply.pub },
};

describe('record requests over Nostr', () => {
  it('a deeplink decodes UTF-8, so a curly apostrophe survives', () => {
    const bytes = new TextEncoder().encode(JSON.stringify(attest));
    const raw = btoa(String.fromCharCode(...bytes));
    const r = parseSignRequest(raw);
    expect(r.intent === 'attest' && r.fields.action).toBe('I got back in with my family’s help');
  });

  it('accepts an attest or cosign request with a reply address, refuses one without', () => {
    expect(readRecordRequest(attest)?.response_channel.requester_pubkey).toBe(reply.pub);
    const { response_channel: _rc, ...noReply } = attest;
    expect(readRecordRequest(noReply)).toBeNull();
    expect(readRecordRequest({ ...attest, intent: 'sign-in' })).toBeNull();
    expect(readRecordRequest({ ...attest, response_channel: { kind: 'nostr', requester_pubkey: 'zz' } })).toBeNull();
  });

  it('delivers an encrypted request addressed to this wallet, drops a tampered one', async () => {
    const wallet = Wallet.generate();
    const t = new FakeTransport();
    const got: InboxRecordRequest[] = [];
    subscribeRecordRequests(t, wallet, (i) => got.push(i));
    const sender = keypair();
    const event = await buildEvent({
      pubkey: sender.pub,
      sign: (d) => hex(schnorr.sign(d, sender.priv)),
      kind: RECORD_REQUEST_KIND,
      content: encryptTo(JSON.stringify(attest), wallet.publicKey, sender.priv),
      tags: [['p', wallet.publicKey]],
    });
    t.handlers[0]!(event);
    await new Promise((r) => setTimeout(r, 50));
    t.handlers[0]!({ ...event, id: 'ff'.repeat(32), content: event.content.slice(0, -4) + 'AAAA' });
    await new Promise((r) => setTimeout(r, 50));
    expect(got).toHaveLength(1);
    expect(got[0]!.request.nonce).toBe(attest.nonce);
  });

  describe('approve', () => {
    const originalLocation = window.location;
    beforeEach(() => {
      Object.defineProperty(window, 'location', { writable: true, configurable: true, value: { ...originalLocation, href: 'https://wallet.example/sign' } });
    });
    afterEach(() => {
      Object.defineProperty(window, 'location', { writable: true, configurable: true, value: originalLocation });
    });

    function open(t: FakeTransport, wallet: Wallet): { nonce?: string; envelope: Attestation } {
      const wrap = t.published[0]!;
      expect(wrap.kind).toBe(1059);
      expect(wrap.pubkey).not.toBe(wallet.publicKey);
      const seal = JSON.parse(decryptFrom(wrap.content, wrap.pubkey, reply.priv)) as { pubkey: string; content: string };
      const inner = JSON.parse(decryptFrom(seal.content, seal.pubkey, reply.priv)) as { kind: number; pubkey: string; content: string };
      expect(inner.kind).toBe(RECORD_RESPONSE_KIND);
      expect(inner.pubkey).toBe(wallet.publicKey);
      return (JSON.parse(decryptFrom(inner.content, inner.pubkey, reply.priv)) as { grant: { nonce?: string; envelope: Attestation } }).grant;
    }

    it('signs a new record and sends it back over Nostr, never redirecting', async () => {
      const wallet = Wallet.generate();
      const t = new FakeTransport();
      const req = readRecordRequest(attest)!;
      const result = await approveSignRequest(wallet, 'owner-1', req, async () => {}, null, false, t);
      expect(result).toEqual({ delivered: 'nostr' });
      expect(window.location.href).toBe('https://wallet.example/sign');
      const grant = open(t, wallet);
      expect(grant.nonce).toBe(attest.nonce);
      expect(verifyEnvelope(grant.envelope).valid).toBe(true);
    });

    it('adds its signature to someone else’s record and sends the merged record back', async () => {
      const author = Wallet.generate();
      const wallet = Wallet.generate();
      const env = author.attest({ kind: 'meta', tier: 'routine', subject: 'x', fields: { action: 'drill' } });
      const req = readRecordRequest({ ...attest, intent: 'cosign-existing', envelope: env })!;
      const t = new FakeTransport();
      await approveSignRequest(wallet, 'owner-1', req, async () => {}, null, false, t);
      const signers = verifyEnvelope(open(t, wallet).envelope).signers.filter((s) => s.valid).map((s) => s.signer);
      expect(signers).toEqual(expect.arrayContaining([author.publicKey, wallet.publicKey]));
    });

    it('refuses to claim delivery with no network', async () => {
      const wallet = Wallet.generate();
      await expect(approveSignRequest(wallet, 'owner-1', readRecordRequest(attest)!, async () => {}, null, false, null)).rejects.toThrow(/not connected/);
    });
  });
});
