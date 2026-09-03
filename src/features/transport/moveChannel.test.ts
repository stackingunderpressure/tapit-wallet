import { describe, it, expect } from 'vitest';
import { Wallet, type Attestation } from 'tapit-attest';
import { buildMoveDraftInput, moveLink } from '../move-chain/moveChain.ts';
import {
  buildMoveEvent,
  publishMove,
  subscribeMoves,
  MOVE_EVENT_KIND,
  type IncomingMove,
} from './moveChannel.ts';
import { buildEvent, verifyEvent, type TransportEvent } from './nostrEvent.ts';
import type {
  PublishResult,
  RelayStatus,
  Subscription,
  Transport,
  TransportEventHandler,
} from './transport.ts';
import type { TransportFilter } from './nostrEvent.ts';

// Fake transport: records publishes, replays events into the subscriber.
class FakeTransport implements Transport {
  published: TransportEvent[] = [];
  lastFilter: TransportFilter | null = null;
  private handler: TransportEventHandler | null = null;

  async publish(event: TransportEvent): Promise<PublishResult> {
    this.published.push(event);
    return { eventId: event.id, dispatched: 1, accepted: ['relay'], rejected: [], pending: [] };
  }
  subscribe(filter: TransportFilter, onEvent: TransportEventHandler): Subscription {
    this.lastFilter = filter;
    this.handler = onEvent;
    return { close: () => { this.handler = null; } };
  }
  emit(event: TransportEvent): void {
    this.handler?.(event);
  }
  close(): void {}
  relayStatus(): readonly RelayStatus[] { return []; }
  subscribeStatus(): () => void { return () => {}; }
}

const tick = () => new Promise((r) => setTimeout(r, 15));
const TOPIC = 'beatthehodl';

function genesisMove(w: Wallet): Attestation {
  return w.attest(buildMoveDraftInput({ subject: w.identity, payload: { kind: 'arm', price: 76582, usd: 1000 }, seq: 0, prevHash: '' }));
}

describe('buildMoveEvent — wire shape', () => {
  it('is a public move event, self-consistent and verifiable', async () => {
    const w = Wallet.generate();
    const ev = await buildMoveEvent(w, genesisMove(w), { topic: TOPIC });
    expect(ev.kind).toBe(MOVE_EVENT_KIND);
    expect(ev.pubkey).toBe(w.publicKey);
    expect(await verifyEvent(ev)).toBe(true);
    expect(ev.tags).toContainEqual(['t', TOPIC]);
    expect(ev.tags).toContainEqual(['seq', '0']);
    // Genesis carries no chain-root e-tag (it IS the root).
    expect(ev.tags.some((t) => t[0] === 'e')).toBe(false);
    // The move round-trips through the content.
    expect(JSON.parse(ev.content).subject).toBe(w.identity);
  });

  it('a later move carries the chain root as an e-tag', async () => {
    const w = Wallet.generate();
    const g = genesisMove(w);
    const gid = moveLink(g);
    const leg = w.attest(buildMoveDraftInput({ subject: w.identity, payload: { kind: 'buy', price: 70000, usd: 250 }, seq: 1, prevHash: gid }));
    const ev = await buildMoveEvent(w, leg, { topic: TOPIC, genesisId: gid });
    expect(ev.tags).toContainEqual(['e', gid, '', 'root']);
    expect(ev.tags).toContainEqual(['seq', '1']);
  });
});

describe('publishMove', () => {
  it('publishes the built event through the transport', async () => {
    const w = Wallet.generate();
    const t = new FakeTransport();
    const { event, publish } = await publishMove(t, w, genesisMove(w), { topic: TOPIC });
    expect(t.published).toHaveLength(1);
    expect(t.published[0]!.id).toBe(event.id);
    expect(publish.accepted).toEqual(['relay']);
  });
});

describe('subscribeMoves — receive + guard', () => {
  it('filters by kind, topic, and genesis', () => {
    const t = new FakeTransport();
    subscribeMoves(t, { topic: TOPIC, genesisId: 'gid', since: 100 }, () => {});
    expect(t.lastFilter).toMatchObject({ kinds: [MOVE_EVENT_KIND], '#t': [TOPIC], '#e': ['gid'], since: 100 });
  });

  it('delivers a valid move once, with its parsed meta', async () => {
    const w = Wallet.generate();
    const t = new FakeTransport();
    const got: IncomingMove[] = [];
    subscribeMoves(t, { topic: TOPIC }, (m) => got.push(m));
    const ev = await buildMoveEvent(w, genesisMove(w), { topic: TOPIC });
    t.emit(ev);
    await tick();
    t.emit(ev); // same id re-published later (e.g. another relay) — must dedupe
    await tick();
    expect(got).toHaveLength(1);
    expect(got[0]!.senderPubkey).toBe(w.publicKey);
    expect(got[0]!.meta.seq).toBe(0);
    expect(got[0]!.meta.payload).toEqual({ kind: 'arm', price: 76582, usd: 1000 });
  });

  it('drops non-JSON content', async () => {
    const w = Wallet.generate();
    const t = new FakeTransport();
    const got: IncomingMove[] = [];
    subscribeMoves(t, { topic: TOPIC }, (m) => got.push(m));
    const junk = await buildEvent({ pubkey: w.publicKey, sign: (d) => w.signDigest(d), kind: MOVE_EVENT_KIND, content: 'not json', tags: [['t', TOPIC]] });
    t.emit(junk);
    await tick();
    expect(got).toHaveLength(0);
  });

  it('drops a move whose broadcaster is not its signer', async () => {
    const author = Wallet.generate();
    const intruder = Wallet.generate();
    const t = new FakeTransport();
    const got: IncomingMove[] = [];
    subscribeMoves(t, { topic: TOPIC }, (m) => got.push(m));
    // intruder wraps author's genuinely-signed move under intruder's key.
    const foreign = await buildEvent({
      pubkey: intruder.publicKey,
      sign: (d) => intruder.signDigest(d),
      kind: MOVE_EVENT_KIND,
      content: JSON.stringify(genesisMove(author)),
      tags: [['t', TOPIC]],
    });
    t.emit(foreign);
    await tick();
    expect(got).toHaveLength(0);
  });
});
