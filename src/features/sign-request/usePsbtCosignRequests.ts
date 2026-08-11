import { useContext, useEffect, useRef, useState } from 'react';
import { WalletContext } from '../wallet-core/WalletContext.ts';
import { dismissedRequestsStore } from '../storage/dismissedRequestsStore.ts';
import { channelDiagnostics } from '../transport/channelDiagnostics.ts';
import type { InboxPsbtCosignRequest } from './psbtCosignChannel.ts';

export interface PsbtCosignRequestsState {
  requests: readonly InboxPsbtCosignRequest[];
  /** Remove a request from view once the operator has opened it to
   *  review (IncomingPsbtCosignBanner's "Review" button) or explicitly
   *  declined it, and persist that so a relay replay or a remount never
   *  brings it back looking unhandled. Operator, 2026-08-11: "Even after
   *  doing the work the tab acts like its first time." Before this, a
   *  psbt-cosign request was never removed from state at all -- Review
   *  only navigated to /sign, it never called anything resembling
   *  dismiss -- so it kept showing "1 incoming spend request" no matter
   *  how many times it had already been opened and signed. */
  dismiss: (eventId: string) => void;
}

const NAMESPACE = 'psbt-cosign';

// Cut B stage B3, slice 1 -- "prove the pipe": subscribe to incoming
// psbt-cosign requests over Nostr and hold them in state. Reads
// wallet/transport straight from WalletContext instead of being wired
// into WalletProvider's own props/state -- WalletProvider.tsx is at its
// 800-line hard limit (per this repo's manifest doctrine), so this
// composes as an independent consumer of the existing context rather
// than growing that file by a single line.
export function usePsbtCosignRequests(): PsbtCosignRequestsState {
  const ctx = useContext(WalletContext);
  const transport = ctx?.transport ?? null;
  const wallet = ctx?.wallet ?? null;
  const ownerId = ctx?.ownerId ?? null;
  const [requests, setRequests] = useState<readonly InboxPsbtCosignRequest[]>([]);
  const subRef = useRef<{ close(): void } | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!ownerId) {
      dismissedRef.current = new Set();
      return;
    }
    let alive = true;
    void dismissedRequestsStore.load(ownerId, NAMESPACE).then((set) => {
      if (alive) dismissedRef.current = set;
    });
    return () => {
      alive = false;
    };
  }, [ownerId]);

  useEffect(() => {
    if (!transport || !wallet) return;
    let cancelled = false;
    setRequests([]);
    void import('./psbtCosignChannel.ts').then(({ subscribePsbtCosignRequests }) => {
      if (cancelled) return;
      const sub = subscribePsbtCosignRequests(transport, wallet, (item) => {
        if (dismissedRef.current.has(item.eventId)) {
          // 2026-08-11, operator: "still not seeing in inbox or banner"
          // -- psbtCosignChannel.ts already logged 'delivered' for this
          // event; the reason it never becomes a banner is HERE, not a
          // decrypt problem. Most likely cause: this is the same signed
          // event (Nostr events are content-addressed, so a relay resend
          // or DynastyTrust's outbox retry carries the identical id) as
          // one already reviewed/declined earlier -- a genuinely new
          // spend request needs a freshly built PSBT on DynastyTrust's
          // side, not a resend of an old one.
          void channelDiagnostics.record(
            'psbt-cosign',
            'suppressed',
            `eventId=${item.eventId.slice(0, 12)} already dismissed (reviewed/declined earlier) -- this is the SAME signed request being redelivered, not a new one`,
          );
          return;
        }
        setRequests((prev) => {
          if (prev.some((r) => r.eventId === item.eventId)) return prev;
          return [...prev, item];
        });
      });
      subRef.current = sub;
    });
    return () => {
      cancelled = true;
      if (subRef.current) {
        subRef.current.close();
        subRef.current = null;
      }
    };
  }, [transport, wallet]);

  const dismiss = (eventId: string) => {
    if (ownerId) {
      dismissedRef.current.add(eventId);
      void dismissedRequestsStore.add(ownerId, NAMESPACE, eventId);
    }
    setRequests((prev) => prev.filter((r) => r.eventId !== eventId));
  };

  return { requests, dismiss };
}
