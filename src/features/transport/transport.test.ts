import { describe, it, expect } from 'vitest';
import {
  generateKeypair,
  identityAttestation,
  signEnvelope,
} from 'tapit-attest';
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

function signedIdentity(name: string): { att: Attestation; priv: string; pub: string } {
  const kp = generateKeypair();
  const att = signEnvelope(
    identityAttestation({
      subject: kp.publicKey,
      tier: 'notable',
      fields: { display_name: name },
    }),
    kp.privateKey,
  );
  return { att, priv: kp.privateKey, pub: kp.publicKey };
}

describe('Nostr event signing', () => {
  it('round-trips through buildEvent + verifyEvent', async () => {
    const kp = generateKeypair();
    const event = await buildEvent({
      pubkey: kp.publicKey,
      privkey: kp.privateKey,
      kind: 1,
      content: 'hello world',
    });
    expect(await verifyEvent(event)).toBe(true);
  });

  it('rejects an event whose content was tampered', async () => {
    const kp = generateKeypair();
    const event = await buildEvent({
      pubkey: kp.publicKey,
      privkey: kp.privateKey,
      kind: 1,
      content: 'original',
    });
    const tampered: TransportEvent = { ...event, content: 'changed' };
    expect(await verifyEvent(tampered)).toBe(false);
  });

  it('rejects an event whose pubkey was swapped', async () => {
    const kp = generateKeypair();
    const other = generateKeypair();
    const event = await buildEvent({
      pubkey: kp.publicKey,
      privkey: kp.privateKey,
      kind: 1,
      content: 'mine',
    });
    const swapped: TransportEvent = { ...event, pubkey: other.publicKey };
    expect(await verifyEvent(swapped)).toBe(false);
  });

  it('produces a deterministic id for fixed inputs', async () => {
    const kp = generateKeypair();
    const a = await buildEvent({
      pubkey: kp.publicKey,
      privkey: kp.privateKey,
      kind: 1,
      content: 'same',
      created_at: 1_000_000,
    });
    const b = await buildEvent({
      pubkey: kp.publicKey,
      privkey: kp.privateKey,
      kind: 1,
      content: 'same',
      created_at: 1_000_000,
    });
    expect(a.id).toBe(b.id);
  });
});

describe('encrypted inbox round-trip', () => {
  it('delivers a signed envelope from Alice to Bob through a transport', async () => {
    const alice = signedIdentity('Alice');
    const bob = signedIdentity('Bob');
    const transport = new FakeTransport();
    const received: Attestation[] = [];
    subscribeInbox(transport, bob.pub, bob.priv, (item) => {
      received.push(item.envelope);
    });
    await sendEnvelopeTo(transport, alice.att, bob.pub, alice.pub, alice.priv);
    await flush();
    expect(received).toHaveLength(1);
    expect(received[0]!.subject).toBe(alice.pub);
  });

  it('uses the TAPIT_ENVELOPE_KIND and addresses the recipient in a p tag', async () => {
    const alice = signedIdentity('Alice');
    const bob = signedIdentity('Bob');
    const transport = new FakeTransport();
    let captured: TransportEvent | null = null;
    transport.subscribe({}, (e) => { captured = e; });
    await sendEnvelopeTo(transport, alice.att, bob.pub, alice.pub, alice.priv);
    await flush();
    expect(captured).not.toBeNull();
    const ev = captured as unknown as TransportEvent;
    expect(ev.kind).toBe(TAPIT_ENVELOPE_KIND);
    expect(ev.tags.some((t) => t[0] === 'p' && t[1] === bob.pub)).toBe(true);
  });

  it('drops a tampered event silently — handler is never called', async () => {
    const alice = signedIdentity('Alice');
    const bob = signedIdentity('Bob');
    const cheating = new FakeTransport();
    const seen: Attestation[] = [];
    subscribeInbox(cheating, bob.pub, bob.priv, (item) => {
      seen.push(item.envelope);
    });
    // Build a real envelope event, then tamper its ciphertext.
    let captured: TransportEvent | null = null;
    const peek = new FakeTransport();
    peek.subscribe({}, (e) => { captured = e; });
    await sendEnvelopeTo(peek, alice.att, bob.pub, alice.pub, alice.priv);
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
    const alice = signedIdentity('Alice');
    const bob = signedIdentity('Bob');
    const eve = signedIdentity('Eve');
    const transport = new FakeTransport();
    const seen: Attestation[] = [];
    // Eve listens — Alice addresses Bob — Eve must not be able to decrypt
    // even if she somehow rewrites the p tag to point at herself.
    subscribeInbox(transport, eve.pub, eve.priv, (item) => {
      seen.push(item.envelope);
    });
    let captured: TransportEvent | null = null;
    const peek = new FakeTransport();
    peek.subscribe({}, (e) => { captured = e; });
    await sendEnvelopeTo(peek, alice.att, bob.pub, alice.pub, alice.priv);
    await flush();
    const ev = captured as unknown as TransportEvent;
    const rerouted: TransportEvent = {
      ...ev,
      tags: [['p', eve.pub]],
    };
    // Note: the rerouted event's id no longer matches its content
    // because we changed the tags; verifyEvent will reject it first.
    await transport.publish(rerouted);
    await flush();
    expect(seen).toHaveLength(0);
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
    const kp = generateKeypair();
    transport.subscribe({ kinds: [1] }, () => undefined);
    const event = await buildEvent({
      pubkey: kp.publicKey,
      privkey: kp.privateKey,
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
    const kp = generateKeypair();
    const event = await buildEvent({
      pubkey: kp.publicKey,
      privkey: kp.privateKey,
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

// encryptedInbox's handler chains through crypto.subtle.digest in
// verifyEvent — a real async task, not just a microtask. Sleep one
// macrotask to give the promise chain time to drain before
// assertions.
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
