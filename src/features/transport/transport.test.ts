import { describe, it, expect } from 'vitest';
import {
  Wallet,
  encryptTo as nip44EncryptTo,
  generateKeypair,
  identityAttestation,
  signDigest as schnorrSignDigest,
} from 'tapit-attest';
import type { Attestation } from 'tapit-attest';

import {
  TAPIT_ENVELOPE_KIND,
  buildEvent,
  verifyEvent,
  type TransportEvent,
  type TransportFilter,
} from './nostrEvent.ts';
import { NIP17_GIFT_WRAP_KIND } from './nip17.ts';
import { NostrTransport } from './nostrTransport.ts';
import {
  sendChatMessageTo,
  sendEnvelopeTo,
  sendEnvelopeToSelf,
  subscribeChatMessages,
  subscribeInbox,
  type InboxChatMessage,
} from './encryptedInbox.ts';
import { connectWallet } from './connectWallet.ts';
import type {
  PublishResult,
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

  async publish(event: TransportEvent): Promise<PublishResult> {
    for (const sub of this.subs) {
      if (matches(sub.filter, event)) sub.onEvent(event);
    }
    return {
      eventId: event.id,
      dispatched: 1,
      accepted: ['fake://local'],
      rejected: [],
      pending: [],
    };
  }

  subscribe(filter: TransportFilter, onEvent: TransportEventHandler): Subscription {
    const rec = { filter, onEvent };
    this.subs.add(rec);
    return { close: () => { this.subs.delete(rec); } };
  }

  close(): void {
    this.subs.clear();
  }

  relayStatus() {
    return [{ url: 'fake://local', open: true }];
  }

  subscribeStatus(handler: (s: readonly { url: string; open: boolean }[]) => void): () => void {
    handler(this.relayStatus());
    return () => {};
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
    await waitUntil(() => received.length >= 1);
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

  it('self-CC round-trips — wallet encrypts to its own pubkey and decrypts on receive', async () => {
    const alice = newWalletAs('Alice');
    const transport = new FakeTransport();
    const received: Attestation[] = [];
    const senders: string[] = [];
    subscribeInbox(transport, alice.wallet, (item) => {
      received.push(item.envelope);
      senders.push(item.senderPubkey);
    });
    await sendEnvelopeToSelf(transport, alice.identity, alice.wallet);
    await waitUntil(() => received.length >= 1);
    expect(received).toHaveLength(1);
    // The self-CC arrives with senderPubkey == recipient (own identity);
    // the inbox handler at the application layer uses that signal to
    // auto-hold instead of routing to UI.
    expect(senders[0]).toBe(alice.wallet.publicKey);
    expect(received[0]!.subject).toBe(alice.wallet.publicKey);
  });
});

describe('chat-message round-trip (NIP-17 gift-wrapped, kind 1059)', () => {
  it('delivers a signed chat payload from Alice to Bob through a transport', async () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const transport = new FakeTransport();
    const received: InboxChatMessage[] = [];
    subscribeChatMessages(transport, bob.wallet, (item) => {
      received.push(item);
    });
    await sendChatMessageTo(
      transport,
      { text: 'we were here, bang bang' },
      bob.wallet.publicKey,
      alice.wallet,
    );
    await waitUntil(() => received.length >= 1);
    expect(received).toHaveLength(1);
    expect(received[0]!.payload.text).toBe('we were here, bang bang');
    expect(received[0]!.senderPubkey).toBe(alice.wallet.publicKey);
  });

  it('uses NIP-17 gift-wrap kind 1059 and addresses the recipient in a p tag with an EPHEMERAL pubkey (not the real sender)', async () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const transport = new FakeTransport();
    let captured: TransportEvent | null = null;
    transport.subscribe({}, (e) => { captured = e; });
    await sendChatMessageTo(
      transport,
      { text: 'wire-shape check' },
      bob.wallet.publicKey,
      alice.wallet,
    );
    await flush();
    expect(captured).not.toBeNull();
    const ev = captured as unknown as TransportEvent;
    expect(ev.kind).toBe(NIP17_GIFT_WRAP_KIND);
    expect(ev.tags.some((t) => t[0] === 'p' && t[1] === bob.wallet.publicKey)).toBe(true);
    // Privacy property: the gift wrap's outer pubkey MUST be the
    // ephemeral wrapper, NOT Alice's real pubkey. The relay never
    // sees the real sender.
    expect(ev.pubkey).not.toBe(alice.wallet.publicKey);
  });

  it('the chat subscription does not see envelope-kind events and vice versa', async () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const transport = new FakeTransport();
    const chatSeen: InboxChatMessage[] = [];
    const envSeen: Attestation[] = [];
    subscribeChatMessages(transport, bob.wallet, (item) => { chatSeen.push(item); });
    subscribeInbox(transport, bob.wallet, (item) => { envSeen.push(item.envelope); });
    await sendEnvelopeTo(transport, alice.identity, bob.wallet.publicKey, alice.wallet);
    await sendChatMessageTo(
      transport,
      { text: 'just a hello' },
      bob.wallet.publicKey,
      alice.wallet,
    );
    await waitUntil(() => envSeen.length >= 1 && chatSeen.length >= 1);
    expect(envSeen).toHaveLength(1);
    expect(chatSeen).toHaveLength(1);
    expect(chatSeen[0]!.payload.text).toBe('just a hello');
  });

  it('drops a tampered chat event silently — handler is never called', async () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const cheating = new FakeTransport();
    const seen: InboxChatMessage[] = [];
    subscribeChatMessages(cheating, bob.wallet, (item) => { seen.push(item); });
    let captured: TransportEvent | null = null;
    const peek = new FakeTransport();
    peek.subscribe({}, (e) => { captured = e; });
    await sendChatMessageTo(
      peek,
      { text: 'hi' },
      bob.wallet.publicKey,
      alice.wallet,
    );
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

  it('drops a chat event rerouted to a different recipient (wrong-recipient MAC failure)', async () => {
    const alice = newWalletAs('Alice');
    const bob = newWalletAs('Bob');
    const eve = newWalletAs('Eve');
    const transport = new FakeTransport();
    const seen: InboxChatMessage[] = [];
    subscribeChatMessages(transport, eve.wallet, (item) => { seen.push(item); });
    let captured: TransportEvent | null = null;
    const peek = new FakeTransport();
    peek.subscribe({}, (e) => { captured = e; });
    await sendChatMessageTo(
      peek,
      { text: 'private' },
      bob.wallet.publicKey,
      alice.wallet,
    );
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

  it('drops a malformed gift wrap silently — kind 1059 with non-JSON inner ciphertext', async () => {
    const bob = newWalletAs('Bob');
    const transport = new FakeTransport();
    const seen: InboxChatMessage[] = [];
    subscribeChatMessages(transport, bob.wallet, (item) => { seen.push(item); });
    // Hand-roll a kind-1059 event whose ephemeral signature verifies
    // and whose outer NIP-44 layer decrypts cleanly — but the inner
    // plaintext is not valid JSON. Bob's unwrapGiftWrap should fail
    // at the seal-JSON-parse step and silently drop.
    const ephemeral = generateKeypair();
    const garbageInner = 'not json at all';
    const wrapCiphertext = nip44EncryptTo(
      garbageInner,
      bob.wallet.publicKey,
      ephemeral.privateKey,
    );
    const event = await buildEvent({
      pubkey: ephemeral.publicKey,
      sign: (d) => schnorrSignDigest(d, ephemeral.privateKey),
      kind: NIP17_GIFT_WRAP_KIND,
      content: wrapCiphertext,
      tags: [['p', bob.wallet.publicKey]],
    });
    await transport.publish(event);
    await flush();
    expect(seen).toHaveLength(0);
  });

  it('drops a gift wrap whose decrypted seal has the wrong shape — JSON but missing kind/sig fields', async () => {
    const bob = newWalletAs('Bob');
    const transport = new FakeTransport();
    const seen: InboxChatMessage[] = [];
    subscribeChatMessages(transport, bob.wallet, (item) => { seen.push(item); });
    // Inner plaintext is valid JSON but does not resemble a kind-13
    // seal event (no kind, no sig, no pubkey). Bob's unwrapGiftWrap
    // should fail at the narrowToTransportEvent step and drop.
    const ephemeral = generateKeypair();
    const wrapCiphertext = nip44EncryptTo(
      JSON.stringify({ unexpected: 'shape' }),
      bob.wallet.publicKey,
      ephemeral.privateKey,
    );
    const event = await buildEvent({
      pubkey: ephemeral.publicKey,
      sign: (d) => schnorrSignDigest(d, ephemeral.privateKey),
      kind: NIP17_GIFT_WRAP_KIND,
      content: wrapCiphertext,
      tags: [['p', bob.wallet.publicKey]],
    });
    await transport.publish(event);
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
    const publishPromise = transport.publish(event);
    // publish now waits for relay OK acks; deliver one so it settles.
    fake.deliver(['OK', event.id, true, '']);
    await publishPromise;
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

  it('a fresh subscription still receives an event a PRIOR, now-closed subscription already saw (regression, operator 2026-08-08: "I\'ve never been able to receive a message")', async () => {
    // Mirrors real app usage: WalletProvider keeps ONE NostrTransport
    // instance alive for the whole session, while a feature screen (e.g.
    // the psbt-cosign banner on HomeScreen) mounts/unmounts its own
    // subscription as the operator navigates away and back. A relay
    // resends its backlog to every fresh REQ, including a replacement
    // subscription for the same listener -- dedup must not be keyed
    // globally across the transport, or that backlogged event is lost
    // forever the moment the operator ever navigates away before seeing it.
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

    const firstSeen: TransportEvent[] = [];
    const firstSub = transport.subscribe({}, (e) => { firstSeen.push(e); });
    fake.deliver(['EVENT', 'tap-1', event]);
    expect(firstSeen).toHaveLength(1);

    // Screen unmounts (navigate away), then remounts (navigate back) --
    // a brand-new subscription against the SAME transport instance.
    firstSub.close();
    const secondSeen: TransportEvent[] = [];
    transport.subscribe({}, (e) => { secondSeen.push(e); });
    // The relay resends its backlog to the new REQ -- same event id,
    // new subscription id.
    fake.deliver(['EVENT', 'tap-2', event]);
    expect(secondSeen).toHaveLength(1);
    expect(secondSeen[0]!.id).toBe(event.id);

    transport.close();
  });
});

describe('NostrTransport delivery acks (5c-iii-a)', () => {
  it('resolves publish with accepted when the relay returns OK true', async () => {
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
      content: 'ack me',
    });
    const publishPromise = transport.publish(event);
    fake.deliver(['OK', event.id, true, '']);
    const result = await publishPromise;
    expect(result.accepted).toEqual(['wss://relay.example']);
    expect(result.rejected).toEqual([]);
    expect(result.pending).toEqual([]);
    transport.close();
  });

  it('records rejected with the relay reason when OK is false', async () => {
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
      content: 'rejected',
    });
    const publishPromise = transport.publish(event);
    fake.deliver(['OK', event.id, false, 'rate-limited']);
    const result = await publishPromise;
    expect(result.accepted).toEqual([]);
    expect(result.rejected).toEqual([
      { url: 'wss://relay.example', reason: 'rate-limited' },
    ]);
    transport.close();
  });

  it('settles immediately when every dispatched relay has responded', async () => {
    // Single-relay setup; one OK frame is "all responded" for our purposes.
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
      content: 'fast settle',
    });
    const start = Date.now();
    const publishPromise = transport.publish(event);
    fake.deliver(['OK', event.id, true, '']);
    await publishPromise;
    expect(Date.now() - start).toBeLessThan(1_000);
    transport.close();
  });

  it('drains pending publishes on close — never leaves a promise hanging', async () => {
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
      content: 'never acked',
    });
    const publishPromise = transport.publish(event);
    transport.close();
    const result = await publishPromise;
    expect(result.accepted).toEqual([]);
    expect(result.pending).toEqual(['wss://relay.example']);
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

// Deterministically wait for an async delivery to land, instead of a fixed
// number of macrotask flushes. The receive path awaits crypto.subtle.digest
// (verifyEvent, twice per gift-wrap), which in Node can resolve on the libuv
// threadpool — so under full-suite load (concurrent crypto in other tests)
// the chat/inbox handler can settle AFTER a fixed flush() has already run,
// leaving `received` empty and the assertion flaky. Polling until the
// condition holds (or a generous timeout) removes that race without changing
// production, where the handler is fire-and-forget and the UI just re-renders
// when the message arrives.
async function waitUntil(
  predicate: () => boolean,
  timeoutMs = 3000,
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitUntil: condition not met within timeout');
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
