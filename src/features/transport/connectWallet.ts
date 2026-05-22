import type { Wallet } from 'tapit-attest';
import { DEFAULT_RELAYS } from './defaultRelays.ts';
import { NostrTransport } from './nostrTransport.ts';
import { subscribeInbox, type InboxHandler } from './encryptedInbox.ts';
import type { Transport, Subscription } from './transport.ts';

// connectWallet — the one-call entry point that opens a transport for
// this Wallet, subscribes to its encrypted inbox, and returns a
// handle that owns the lifecycle. The wallet UI calls this once when
// the wallet unlocks and the operator has opted into the network;
// close() runs on lock or opt-out, and tears the whole thing down.
//
// The transport is injectable so tests do not touch the network.
// Without an injected transport, this opens a NostrTransport against
// the default relay set (D-11a) — sovereign users will be able to
// swap relays in a later cut.

export interface ConnectWalletOptions {
  /** Called for every well-formed envelope addressed to this wallet. */
  onEnvelope: InboxHandler;
  /** Only deliver events newer than this Unix-seconds timestamp. */
  since?: number;
  /** Pre-built transport — tests inject a fake, production omits. */
  transport?: Transport;
  /** Relay set to use when transport is not injected. */
  relays?: readonly string[];
  /** WebSocket implementation — tests inject a fake. */
  webSocketImpl?: typeof WebSocket;
}

export interface WalletConnection {
  transport: Transport;
  subscription: Subscription;
  /** Close the inbox subscription and the transport (if internally created). */
  close(): void;
}

export function connectWallet(
  wallet: Wallet,
  options: ConnectWalletOptions,
): WalletConnection {
  const ownsTransport = !options.transport;
  const transport =
    options.transport ??
    new NostrTransport({
      relays: options.relays ?? DEFAULT_RELAYS,
      webSocketImpl: options.webSocketImpl,
    });
  const subscription = subscribeInbox(transport, wallet, options.onEnvelope, {
    since: options.since,
  });
  return {
    transport,
    subscription,
    close: () => {
      subscription.close();
      if (ownsTransport) transport.close();
    },
  };
}
