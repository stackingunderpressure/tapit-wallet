import { useContext, useEffect, useRef, useState } from 'react';
import { WalletContext } from '../wallet-core/WalletContext.ts';
import type { InboxVaultMembershipRequest } from './vaultMembershipChannel.ts';

export interface VaultMembershipRequestsState {
  requests: readonly InboxVaultMembershipRequest[];
  /** Remove a request from local state once it's been accepted or
   *  declined -- there is no server-side ack to wait for; the caller
   *  (the banner) drives dismissal directly. */
  dismiss: (eventId: string) => void;
}

// Mirrors usePsbtCosignRequests.ts's wiring (reads wallet/transport
// straight from WalletContext instead of growing WalletProvider.tsx,
// already at its 800-line hard limit) but, unlike that receive-only
// hook, this one also exposes dismiss -- IncomingVaultMembershipBanner.tsx
// drives an actual accept/decline flow, so it needs a way to clear a
// request from view once handled.
export function useVaultMembershipRequests(): VaultMembershipRequestsState {
  const ctx = useContext(WalletContext);
  const transport = ctx?.transport ?? null;
  const wallet = ctx?.wallet ?? null;
  const [requests, setRequests] = useState<readonly InboxVaultMembershipRequest[]>([]);
  const subRef = useRef<{ close(): void } | null>(null);

  useEffect(() => {
    if (!transport || !wallet) return;
    let cancelled = false;
    setRequests([]);
    void import('./vaultMembershipChannel.ts').then(({ subscribeVaultMembershipRequests }) => {
      if (cancelled) return;
      const sub = subscribeVaultMembershipRequests(transport, wallet, (item) => {
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
    setRequests((prev) => prev.filter((r) => r.eventId !== eventId));
  };

  return { requests, dismiss };
}
