import { useContext, useEffect, useRef, useState } from 'react';
import { WalletContext } from '../wallet-core/WalletContext.ts';
import type { InboxPsbtCosignRequest } from './psbtCosignChannel.ts';

// Cut B stage B3, slice 1 -- "prove the pipe": subscribe to incoming
// psbt-cosign requests over Nostr and hold them in state. Reads
// wallet/transport straight from WalletContext instead of being wired
// into WalletProvider's own props/state -- WalletProvider.tsx is at its
// 800-line hard limit (per this repo's manifest doctrine), so this
// composes as an independent consumer of the existing context rather
// than growing that file by a single line.
//
// Deliberately receive-only for now: this does NOT sign, does NOT call
// approveSignRequest, does NOT respond. That's the next slice, once the
// pipe itself is proven to actually deliver a request from DynastyTrust
// into a real Tapit inbox. Every rail from the risk register still
// applies once signing is wired in -- nothing here weakens it, because
// nothing here touches a key.
export function usePsbtCosignRequests(): readonly InboxPsbtCosignRequest[] {
  const ctx = useContext(WalletContext);
  const transport = ctx?.transport ?? null;
  const wallet = ctx?.wallet ?? null;
  const [requests, setRequests] = useState<readonly InboxPsbtCosignRequest[]>([]);
  const subRef = useRef<{ close(): void } | null>(null);

  useEffect(() => {
    if (!transport || !wallet) return;
    let cancelled = false;
    setRequests([]);
    void import('./psbtCosignChannel.ts').then(({ subscribePsbtCosignRequests }) => {
      if (cancelled) return;
      const sub = subscribePsbtCosignRequests(transport, wallet, (item) => {
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

  return requests;
}
