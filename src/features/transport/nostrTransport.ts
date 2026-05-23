import type {
  Subscription,
  Transport,
  TransportEventHandler,
} from './transport.ts';
import type { TransportEvent, TransportFilter } from './nostrEvent.ts';

// Minimal Nostr WebSocket client behind the Transport interface. Speaks
// NIP-01 — the client sends JSON arrays, the relay sends them back:
//   ['EVENT', <event>]                    — client publishes
//   ['REQ', <sub_id>, <filter>, ...]      — client subscribes
//   ['CLOSE', <sub_id>]                   — client unsubscribes
//   ['EVENT', <sub_id>, <event>]          — relay delivers an event
//   ['EOSE', <sub_id>]                    — relay says end-of-stored
//   ['OK', <event_id>, <ok>, <reason>]    — relay ack on publish
//   ['NOTICE', <msg>]                     — relay tells us something
//
// Reliability scope for this cut: best-effort. The transport opens one
// WebSocket per relay, auto-reconnects with backoff on drop, and
// dedupes incoming events by id across relays. Persistent queueing of
// publishes for offline relays is a later concern (5c-iii).

const INITIAL_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

interface SubRecord {
  id: string;
  filter: TransportFilter;
  onEvent: TransportEventHandler;
}

interface RelayConn {
  url: string;
  ws: WebSocket | null;
  open: boolean;
  closed: boolean;
  reconnectMs: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  outbox: string[];
}

export interface NostrTransportOptions {
  relays: readonly string[];
  /** Override WebSocket — tests inject a fake. */
  webSocketImpl?: typeof WebSocket;
}

export class NostrTransport implements Transport {
  private readonly relays: RelayConn[] = [];
  private readonly subs = new Map<string, SubRecord>();
  private readonly seen = new Set<string>();
  private readonly WS: typeof WebSocket;
  private nextSubId = 1;
  private closed = false;

  constructor(options: NostrTransportOptions) {
    this.WS = options.webSocketImpl ?? WebSocket;
    for (const url of options.relays) {
      const conn: RelayConn = {
        url,
        ws: null,
        open: false,
        closed: false,
        reconnectMs: INITIAL_RECONNECT_MS,
        reconnectTimer: null,
        outbox: [],
      };
      this.relays.push(conn);
      this.connect(conn);
    }
  }

  async publish(event: TransportEvent): Promise<void> {
    if (this.closed) throw new Error('transport is closed');
    const frame = JSON.stringify(['EVENT', event]);
    for (const conn of this.relays) this.send(conn, frame);
  }

  subscribe(filter: TransportFilter, onEvent: TransportEventHandler): Subscription {
    if (this.closed) throw new Error('transport is closed');
    const id = `tap-${this.nextSubId++}`;
    const record: SubRecord = { id, filter, onEvent };
    this.subs.set(id, record);
    const frame = JSON.stringify(['REQ', id, filter]);
    for (const conn of this.relays) this.send(conn, frame);
    return {
      close: () => {
        if (!this.subs.delete(id)) return;
        const closeFrame = JSON.stringify(['CLOSE', id]);
        for (const conn of this.relays) this.send(conn, closeFrame);
      },
    };
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.subs.clear();
    for (const conn of this.relays) {
      conn.closed = true;
      if (conn.reconnectTimer) clearTimeout(conn.reconnectTimer);
      conn.reconnectTimer = null;
      conn.outbox.length = 0;
      if (conn.ws) {
        try {
          conn.ws.close();
        } catch {
          // best-effort close
        }
      }
    }
  }

  private connect(conn: RelayConn): void {
    if (this.closed || conn.closed) return;
    let ws: WebSocket;
    try {
      ws = new this.WS(conn.url);
    } catch {
      this.scheduleReconnect(conn);
      return;
    }
    conn.ws = ws;
    conn.open = false;
    ws.onopen = () => {
      conn.open = true;
      conn.reconnectMs = INITIAL_RECONNECT_MS;
      // Re-issue every active subscription and flush queued publishes
      // so a reconnect picks up where the prior session left off.
      for (const sub of this.subs.values()) {
        try {
          ws.send(JSON.stringify(['REQ', sub.id, sub.filter]));
        } catch {
          // socket may have torn down mid-loop; onclose will reconnect
        }
      }
      const queued = conn.outbox.splice(0);
      for (const frame of queued) {
        try {
          ws.send(frame);
        } catch {
          // socket failure mid-flush; remaining items lost this round
        }
      }
    };
    ws.onmessage = (msg: MessageEvent) => {
      if (typeof msg.data !== 'string') return;
      this.handleFrame(msg.data);
    };
    ws.onclose = () => {
      conn.open = false;
      conn.ws = null;
      this.scheduleReconnect(conn);
    };
    ws.onerror = () => {
      // The browser will fire onclose after onerror; let that path handle reconnect.
    };
  }

  private scheduleReconnect(conn: RelayConn): void {
    if (this.closed || conn.closed) return;
    const delay = conn.reconnectMs;
    conn.reconnectMs = Math.min(conn.reconnectMs * 2, MAX_RECONNECT_MS);
    conn.reconnectTimer = setTimeout(() => {
      conn.reconnectTimer = null;
      this.connect(conn);
    }, delay);
  }

  private send(conn: RelayConn, frame: string): void {
    if (conn.open && conn.ws) {
      try {
        conn.ws.send(frame);
        return;
      } catch {
        // fall through to outbox
      }
    }
    conn.outbox.push(frame);
  }

  private handleFrame(raw: string): void {
    let frame: unknown;
    try {
      frame = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(frame) || frame.length < 2) return;
    const [type] = frame;
    if (type !== 'EVENT') return;
    const subId = frame[1];
    const event = frame[2];
    if (typeof subId !== 'string' || typeof event !== 'object' || event === null) {
      return;
    }
    const sub = this.subs.get(subId);
    if (!sub) return;
    const ev = event as TransportEvent;
    if (typeof ev.id !== 'string') return;
    if (this.seen.has(ev.id)) return;
    this.seen.add(ev.id);
    sub.onEvent(ev);
  }
}
