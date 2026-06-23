import { describe, it, expect } from 'vitest';
import {
  Wallet,
  generateKeypair,
  buildProofOfLife,
  buildDuressFlag,
  type Keypair,
  type ProofOfLife,
  type DuressFlag,
} from 'tapit-attest';

import {
  sendLivenessSignal,
  subscribeLiveness,
  TAPIT_LIVENESS_KIND,
  type IncomingLivenessSignal,
  type LivenessSignal,
} from './livenessChannel.ts';
import {
  TAPIT_ENVELOPE_KIND,
  buildEvent,
  type TransportEvent,
  type TransportFilter,
} from './nostrEvent.ts';
import { NIP17_GIFT_WRAP_KIND } from './nip17.ts';
import type {
  PublishResult,
  Subscription,
  Transport,
  TransportEventHandler,
} from './transport.ts';

// In-memory transport — every subscribe is matched against the filter and
// called for every matching publish. Same FakeTransport shape transport.test.ts
// uses; kept in test scope.
class FakeTransport implements Transport {
  private readonly subs = new Set<{
    filter: TransportFilter;
    onEvent: TransportEventHandler;
  }>();

  /** Lets a test re-deliver an event (relay duplicate / replay). */
  deliver(event: TransportEvent): void {
    for (const sub of this.subs) {
      if (matches(sub.filter, event)) sub.onEvent(event);
    }
  }

  async publish(event: TransportEvent): Promise<PublishResult> {
    this.deliver(event);
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
    return {
      close: () => {
        this.subs.delete(rec);
      },
    };
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
    if (!ptag.some((v: string) => ps.includes(v))) return false;
  }
  return true;
}

// The receive path is async (verifyEvent awaits crypto.subtle.digest), so a
// publish resolves before the fire-and-forget handler settles. waitUntil polls
// for a positive delivery; flush gives a few macrotask turns so a negative
// (drop) assertion is meaningful — the handler had its chance and dropped.
async function waitUntil(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitUntil: condition not met within timeout');
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
async function flush(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

// A sender is a raw keypair (so the buildProofOfLife / buildDuressFlag raw-key
// test helpers can mint the INNER signal) plus a Wallet built from that same
// keypair (so sendLivenessSignal can encrypt + outer-sign). subject ===
// senderPubkey === the wallet's pubkey, exactly as a real heartbeat sender.
function makeSender(): { kp: Keypair; wallet: Wallet } {
  const kp = generateKeypair();
  return { kp, wallet: Wallet.fromKeypair(kp) };
}
function proofFor(kp: Keypair): ProofOfLife {
  return buildProofOfLife({
    signerPrivateKey: kp.privateKey,
    issuedAt: new Date('2026-06-23T12:00:00.000Z').toISOString(),
  });
}
function duressFor(kp: Keypair, subject: string): DuressFlag {
  return buildDuressFlag({
    subject,
    signerPrivateKey: kp.privateKey,
    issuedAt: new Date('2026-06-23T12:00:00.000Z').toISOString(),
  });
}

describe('liveness channel — kind', () => {
  it('uses its own dedicated kind, distinct from envelope and chat kinds', () => {
    expect(TAPIT_LIVENESS_KIND).not.toBe(TAPIT_ENVELOPE_KIND);
    expect(TAPIT_LIVENESS_KIND).not.toBe(NIP17_GIFT_WRAP_KIND);
    expect(TAPIT_LIVENESS_KIND).toBe(9575);
  });
});

describe('liveness channel — round-trip', () => {
  it('a proof-of-life published by A is received, decrypted, and inner-verified by B', async () => {
    const a = makeSender();
    const b = Wallet.generate();
    const transport = new FakeTransport();

    const received: IncomingLivenessSignal[] = [];
    subscribeLiveness(transport, b, (item) => received.push(item));

    const signal: LivenessSignal = { kind: 'proof-of-life', signal: proofFor(a.kp) };
    const { event } = await sendLivenessSignal(transport, signal, b.publicKey, a.wallet);

    // Relay sees ciphertext only — never the plaintext signal.
    expect(event.content).not.toContain('proof-of-life');
    expect(event.kind).toBe(TAPIT_LIVENESS_KIND);

    await waitUntil(() => received.length === 1);
    const got = received[0]!;
    expect(got.kind).toBe('proof-of-life');
    expect(got.senderPubkey).toBe(a.wallet.publicKey);
    expect((got.signal as ProofOfLife).subject).toBe(a.wallet.publicKey);
  });

  it('a duress-flag also round-trips', async () => {
    const a = makeSender();
    const b = Wallet.generate();
    const transport = new FakeTransport();

    const received: IncomingLivenessSignal[] = [];
    subscribeLiveness(transport, b, (item) => received.push(item));

    // A raises red on B (B is the subject); A is in B's circle conceptually.
    const signal: LivenessSignal = {
      kind: 'duress-flag',
      signal: duressFor(a.kp, b.publicKey),
    };
    await sendLivenessSignal(transport, signal, b.publicKey, a.wallet);

    await waitUntil(() => received.length === 1);
    const got = received[0]!;
    expect(got.kind).toBe('duress-flag');
    expect((got.signal as DuressFlag).raisedBy).toBe(a.wallet.publicKey);
  });
});

describe('liveness channel — hostile inputs are dropped silently', () => {
  it('a TAMPERED inner signal never reaches the handler', async () => {
    const a = makeSender();
    const b = Wallet.generate();
    const transport = new FakeTransport();

    const received: IncomingLivenessSignal[] = [];
    subscribeLiveness(transport, b, (item) => received.push(item));

    // A mints a valid proof, then tampers the inner signature before sending.
    const good = proofFor(a.kp);
    const tampered: ProofOfLife = {
      ...good,
      // Flip the first signature byte — verifyProofOfLife must reject it.
      signature:
        (good.signature[0] === '0' ? '1' : '0') + good.signature.slice(1),
    };
    const signal: LivenessSignal = { kind: 'proof-of-life', signal: tampered };

    // Encrypt + publish exactly as sendLivenessSignal does (the outer event is
    // perfectly valid; only the INNER liveness signature is forged).
    const plaintext = JSON.stringify(signal);
    const ciphertext = a.wallet.nip44EncryptTo(plaintext, b.publicKey);
    const event = await buildEvent({
      pubkey: a.wallet.publicKey,
      sign: (digest) => a.wallet.signDigest(digest),
      kind: TAPIT_LIVENESS_KIND,
      content: ciphertext,
      tags: [['p', b.publicKey]],
    });
    await transport.publish(event);
    await flush();

    // The forged heartbeat must be dropped by the inner verifier.
    expect(received).toHaveLength(0);
  });

  it('an event with a bad OUTER signature is dropped', async () => {
    const a = makeSender();
    const b = Wallet.generate();
    const transport = new FakeTransport();

    const received: IncomingLivenessSignal[] = [];
    subscribeLiveness(transport, b, (item) => received.push(item));

    // Build a fresh, otherwise-valid event whose id was never seen, then
    // corrupt only the outer Nostr signature. verifyEvent must reject it
    // before any decrypt happens — so dedup is not what drops it.
    const signal: LivenessSignal = { kind: 'proof-of-life', signal: proofFor(a.kp) };
    const plaintext = JSON.stringify(signal);
    const ciphertext = a.wallet.nip44EncryptTo(plaintext, b.publicKey);
    const event = await buildEvent({
      pubkey: a.wallet.publicKey,
      sign: (digest) => a.wallet.signDigest(digest),
      kind: TAPIT_LIVENESS_KIND,
      content: ciphertext,
      tags: [['p', b.publicKey]],
    });
    const broken: TransportEvent = {
      ...event,
      sig: (event.sig[0] === '0' ? '1' : '0') + event.sig.slice(1),
    };
    transport.deliver(broken);
    await flush();

    expect(received).toHaveLength(0);
  });

  it('garbage ciphertext (undecryptable) is dropped', async () => {
    const a = makeSender();
    const b = Wallet.generate();
    const transport = new FakeTransport();

    const received: IncomingLivenessSignal[] = [];
    subscribeLiveness(transport, b, (item) => received.push(item));

    const event = await buildEvent({
      pubkey: a.wallet.publicKey,
      sign: (digest) => a.wallet.signDigest(digest),
      kind: TAPIT_LIVENESS_KIND,
      content: 'not-valid-nip44-ciphertext',
      tags: [['p', b.publicKey]],
    });
    transport.deliver(event);

    expect(received).toHaveLength(0);
  });
});

describe('liveness channel — dedup', () => {
  it('a repeated event id is delivered to the handler only once', async () => {
    const a = makeSender();
    const b = Wallet.generate();
    const transport = new FakeTransport();

    const received: IncomingLivenessSignal[] = [];
    subscribeLiveness(transport, b, (item) => received.push(item));

    const signal: LivenessSignal = { kind: 'proof-of-life', signal: proofFor(a.kp) };
    const { event } = await sendLivenessSignal(transport, signal, b.publicKey, a.wallet);

    await waitUntil(() => received.length === 1);

    // Same event arrives again (multi-relay / replay) — dedup drops it.
    transport.deliver(event);
    await flush();
    expect(received).toHaveLength(1);
  });
});
