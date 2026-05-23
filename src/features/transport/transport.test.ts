import { describe, it, expect } from 'vitest';
import { Wallet, identityAttestation } from 'tapit-attest';
import type { Attestation } from 'tapit-attest';

import {
  TAPIT_ENVELOPE_KIND,
  buildEvent,
  verifyEvent,
  type TransportEvent,
  type TransportFilter,
} from './nostrEvent.ts';
import { NostrTransport } from './nostrTransport.ts';
import { sendEnvelopeTo, subscribeInbox } from './encryptedInbox.ts';
import { connectWallet } from './connectWallet.ts';
import type {
  Subscription,
  Transport,
  TransportEventHandler,
} from './transport.ts';

// In-memory transport — every subscribe is matched against the
// filter and called for every matching publish. Exercises the
// Transport contract without touching the network. Production
// substrate is NostrTransport; FakeTransport stays in test scope.
class FakeTransport implements Transport {
  private readonly subs = new Set<{
    filter: TransportFilter;
    onEvent: TransportEventHandler;
  }>();

  async publish(event: TransportEvent): Promise<void> {
    for (const sub of this.subs) {
      if (matches(sub.filter, event)) sub.onEvent(event);
    }
  }

  subscribe(filter: TransportFilter, onEvent: TransportEventHandler): Subscription {
    const rec = { filter, onEvent };
    this.subs.add(rec);
    return { close: () => { this.subs.delete(rec); } };
  }

  close(): void {
    this.subs.clear();
  }
}

function matches(filter: TransportFilter, event: TransportEvent): boolean {
  if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
  if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
  if (filter.ids && !filter.ids.includes(event.id)) return false;
  if (filter.since !== undefined && event.created_at < filter.since) return false;
  if (filter.until !== undefined && event.created_at > filter.until) return false;
  const ptag = filter['#p'];
  if (ptag) {
    const ps = event.tags.filter((t) => t[0] === 'p').map((t) => t[1]);
    if (!ptag.some((v) => ps.includes(v))) return false;
  }
  return true;
}

function newWalletAs(name: string): { wallet: Wallet; identity: Attestation } {
  const wallet = Wallet.generate();
  const identity = wallet.sign(
    identityAttestation({
      subject: wallet.publicKey,
      tier: 'notable',
      fields: { display_name: name },
    }),
  );
  return { wallet, identity };
}

describe('Nostr event signing', () => {
  it('round-trips through buildEvent + verifyEvent', async () => {
    const wallet = Wallet.generate();
    const event = await buildEvent({
      pubkey: wallet.publicKey,
      sign: (d) => wallet.signDigest(d),
      kind: 1,
      content: 'hello world',
    });
    expect(await verifyEvent(event)).toBe(true);
  });

  it('rejects an event whose content was tampered', async () => {
    const wallet = Wallet.generate();
    const event = await buildEvent({
      pubkey: wallet.publicKey,
      sign: (d) => wallet.signDigest(d),
      kind: 1,
      content: 'original',
    });
    const tampered: TransportEvent = { ...event, content: 'changed' };
    expect(await verifyEvent(tampered)).toBe(false);
  });

  it('rejects an event whose pubkey was swapped', async () => {
    const wallet = Wallet.generate();
    const other = Wallet.generate();
    const event = await buildEvent({
      pubkey: wallet.publicKey,
      sign: (d) => wallet.signDigest(d),
      kind: 1,
      content: 'mine',
    });
    const swapped: TransportEvent = { ...event, pubkey: other.publicKey };
    expect(await verifyEvent(swapped)).toBe(false);
  });

  it('produces a deterministic id for fixed inputs', async () => {
    const wallet = Wallet.generate();
    const a = await buildEvent({
      pubkey: wallet.publicKey,
      sign: (d) => wallet.signDigest(d),
      kind: 1,
      content: 'same',
      created_at: 1_000_000,
    });
    const b = await buildEvent({
      pubkey: wallet.publicKey,
      sign: (d) => wallet.signDigest(d),
      kind: 1,
      content: 'same',
      created_at: 1_000_000,
    });
    expect(a.id).toBe(b.id);
  });
});

describe('encrypted inbox round-trip', () => {
  it('delivers a signed envelope from Alice to Bob through a transport', async () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const transport = new FakeTransport();
    const received: Attestation[] = [];
    subscribeInbox(transport, bob.wallet, (item) => {
      received.push(item.envelope);
    });
    await sendEnvelopeTo(transport, alice.identity, bob.wallet.publicKey, alice.wallet);
    await flush();
    expect(received).toHaveLength(1);
    expect(received[0]!.subject).toBe(alice.wallet.publicKey);
  });

  it('uses the TAPIT_ENVELOPE_KIND and addresses the recipient in a p tag', async () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const transport = new FakeTransport();
    let captured: TransportEvent | null = null;
    transport.subscribe({}, (e) => { captured = e; });
    await sendEnvelopeTo(transport, alice.identity, bob.wallet.publicKey, alice.wallet);
    await flush();
    expect(captured).not.toBeNull();
    const ev = captured as unknown as TransportEvent;
    expect(ev.kind).toBe(TAPIT_ENVELOPE_KIND);
    expect(ev.tags.some((t) => t[0] === 'p' && t[1] === bob.wallet.publicKey)).toBe(true);
  });

  it('drops a tampered event silently — handler is never called', async () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const cheating = new FakeTransport();
    const seen: Attestation[] = [];
    subscribeInbox(cheating, bob.wallet, (item) => {
      seen.push(item.envelope);
    });
    let captured: TransportEvent | null = null;
    const peek = new FakeTransport();
    peek.subscribe({}, (e) => { captured = e; });
    await sendEnvelopeTo(peek, alice.identity, bob.wallet.publicKey, alice.wallet);
    await flush();
    const ev = captured as unknown as TransportEvent;
    const tampered: TransportEvent = {
      ...ev,
      content: ev.content.slice(0, -4) + 'AAAA',
    };
    await cheating.publish(tampered);
    await flush();
    expect(seen).toHaveLength(0);
  });

  it('drops an event addressed to a different recipient (wrong-recipient MAC failure)', async () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const eve = newWalletAs('Eve');
    const transport = new FakeTransport();
    const seen: Attestation[] = [];
    subscribeInbox(transport, eve.wallet, (item) => {
      seen.push(item.envelope);
    });
    let captured: TransportEvent | null = null;
    const peek = new FakeTransport();
    peek.subscribe({}, (e) => { captured = e; });
    await sendEnvelopeTo(peek, alice.identity, bob.wallet.publicKey, alice.wallet);
    await flush();
    const ev = captured as unknown as TransportEvent;
    const rerouted: TransportEvent = {
      ...ev,
      tags: [['p', eve.wallet.publicKey]],
    };
    await transport.publish(rerouted);
    await flush();
    expect(seen).toHaveLength(0);
  });
});

describe('connectWallet — the wallet-level entry point', () => {
  it('opens a connection, routes incoming envelopes, and closes cleanly', async () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const transport = new FakeTransport();
    const received: Attestation[] = [];
    const connection = connectWallet(bob.wallet, {
      transport,
      onEnvelope: (item) => { received.push(item.envelope); },
    });
    await sendEnvelopeTo(transport, alice.identity, bob.wallet.publicKey, alice.wallet);
    await flush();
    expect(received).toHaveLength(1);
    connection.close();
    await sendEnvelopeTo(transport, alice.identity, bob.wallet.publicKey, alice.wallet);
    await flush();
    expect(received).toHaveLength(1);
  });

  it('closes the transport on close when the transport was created internally', () => {
    const wallet = Wallet.generate();
    // No transport passed — connectWallet creates a NostrTransport
    // internally with an injectable WebSocket. We pass a fake WS so
    // no real network is touched.
    const connection = connectWallet(wallet, {
      onEnvelope: () => undefined,
      relays: ['wss://relay.example'],
      webSocketImpl: noopWS(),
    });
    expect(() => connection.close()).not.toThrow();
  });
});

describe('NostrTransport wire-protocol shape', () => {
  it('sends a NIP-01 EVENT frame on publish and a REQ frame on subscribe', async () => {
    const fake = makeFakeWS();
    const transport = new NostrTransport({
      relays: ['wss://relay.example'],
      webSocketImpl: fake.WS,
    });
    fake.ready();
    const wallet = Wallet.generate();
    transport.subscribe({ kinds: [1] }, () => undefined);
    const event = await buildEvent({
      pubkey: wallet.publicKey,
      sign: (d) => wallet.signDigest(d),
      kind: 1,
      content: 'wire test',
    });
    await transport.publish(event);
    const sent = fake.sent();
    expect(sent[0]![0]).toBe('REQ');
    expect(sent[1]![0]).toBe('EVENT');
    expect((sent[1]![1] as TransportEvent).id).toBe(event.id);
    transport.close();
  });

  it('routes an incoming EVENT frame to the matching subscription and dedupes by id', async () => {
    const fake = makeFakeWS();
    const transport = new NostrTransport({
      relays: ['wss://relay.example'],
      webSocketImpl: fake.WS,
    });
    fake.ready();
    const wallet = Wallet.generate();
    const event = await buildEvent({
      pubkey: wallet.publicKey,
      sign: (d) => wallet.signDigest(d),
      kind: 1,
      content: 'inbound',
    });
    const seen: TransportEvent[] = [];
    transport.subscribe({}, (e) => { seen.push(e); });
    fake.deliver(['EVENT', 'tap-1', event]);
    fake.deliver(['EVENT', 'tap-1', event]); // duplicate, must dedupe
    expect(seen).toHaveLength(1);
    expect(seen[0]!.id).toBe(event.id);
    transport.close();
  });
});

// A tiny WebSocket stand-in for the NostrTransport wire tests.
// Records frames sent by the transport and lets the test deliver
// JSON frames back through onmessage. No real socket touched.
function makeFakeWS() {
  let lastInstance: FakeWS | null = null;
  const register = (ws: FakeWS) => { lastInstance = ws; };
  class FakeWS {
    onopen: (() => void) | null = null;
    onmessage: ((e: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    sentFrames: string[] = [];
    constructor(_url: string) {
      register(this);
    }
    send(frame: string) {
      this.sentFrames.push(frame);
    }
    close() {
      if (this.onclose) this.onclose();
    }
  }
  return {
    WS: FakeWS as unknown as typeof WebSocket,
    ready: () => {
      if (lastInstance?.onopen) lastInstance.onopen();
    },
    sent: () =>
      (lastInstance?.sentFrames ?? []).map((s) => JSON.parse(s) as unknown[]),
    deliver: (frame: unknown) => {
      if (lastInstance?.onmessage) {
        lastInstance.onmessage({ data: JSON.stringify(frame) });
      }
    },
  };
}

// An inert WebSocket for tests that exercise connection lifecycle
// without caring about the wire traffic.
function noopWS(): typeof WebSocket {
  class NoopWS {
    onopen: (() => void) | null = null;
    onmessage: ((e: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(_url: string) {}
    send(_frame: string) {}
    close() {
      if (this.onclose) this.onclose();
    }
  }
  return NoopWS as unknown as typeof WebSocket;
}

// encryptedInbox's handler chains through crypto.subtle.digest in
// verifyEvent — a real async task, not just a microtask. Sleep
// multiple macrotask cycles to give the promise chain time to drain
// before assertions; one cycle was occasionally tight on cold runs.
async function flush(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
