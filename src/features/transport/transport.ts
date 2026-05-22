// Transport-agnostic peer transport. The wallet talks to other
// wallets through this interface — never directly to a Nostr relay
// or any other substrate. The Nostr WebSocket implementation is one
// concrete Transport; a future libp2p, gossipsub, or other substrate
// would be another. Per D-06 the substrate is swappable and never a
// hard dependency; per D-11a Nostr is the default.
//
// One Transport instance represents a connection to a set of relays.
// publish broadcasts an event to all of them; subscribe asks all of
// them for matching events and merges the streams. Implementations
// must dedupe by event id so the same event arriving on multiple
// relays delivers once.

import type { TransportEvent, TransportFilter } from './nostrEvent.ts';

export type TransportEventHandler = (event: TransportEvent) => void;

export interface Subscription {
  /** Stop receiving events for this subscription. Idempotent. */
  close(): void;
}

export interface Transport {
  /**
   * Broadcast one signed event to every relay. Resolves once the
   * implementation has dispatched the event — does not wait for
   * relay acknowledgements. Acknowledgement-aware delivery is a
   * later concern (5c-iii).
   */
  publish(event: TransportEvent): Promise<void>;

  /**
   * Subscribe to events matching the filter. The handler is called
   * for each matching event, deduped across relays. The returned
   * Subscription's close() stops the flow.
   */
  subscribe(filter: TransportFilter, onEvent: TransportEventHandler): Subscription;

  /**
   * Close every relay connection and release resources. The Transport
   * is unusable after this. Idempotent.
   */
  close(): void;
}
