import { useContext, useEffect, useRef, useState } from 'react';
import { WalletContext } from '../wallet-core/WalletContext.ts';
import { findVaultTrail } from './vaultTrail.ts';
import { dismissedRequestsStore } from '../storage/dismissedRequestsStore.ts';
import type { InboxVaultMembershipRequest } from './vaultMembershipChannel.ts';

export interface VaultMembershipRequestsState {
  requests: readonly InboxVaultMembershipRequest[];
  /** Remove a request from local state once it's been accepted or
   *  declined -- there is no server-side ack to wait for; the caller
   *  (the banner) drives dismissal directly. Also persists the
   *  vault+role as durably answered so a relay replay or a fresh
   *  request for the same offer never resurfaces it. */
  dismiss: (eventId: string) => void;
}

const NAMESPACE = 'vault-membership';
const dismissKey = (vaultDescriptor: string, role: string) => `${vaultDescriptor}::${role}`;

// Mirrors usePsbtCosignRequests.ts's wiring (reads wallet/transport
// straight from WalletContext instead of growing WalletProvider.tsx,
// already at its 800-line hard limit) but, unlike that receive-only
// hook, this one also exposes dismiss -- IncomingVaultMembershipBanner.tsx
// drives an actual accept/decline flow, so it needs a way to clear a
// request from view once handled.
//
// Operator, 2026-08-11: "Even after doing the work the tab acts like
// its first time." Two independent defenses against a request
// reappearing after it's been answered: (1) an ALREADY-ACCEPTED
// request is filtered out before it ever reaches state, by checking
// holdings for a matching, verified, self-signed membership attestation
// (findVaultTrail) -- accepting mints exactly that, so this is
// authoritative and survives even if the persisted-dismiss store below
// were somehow missing an entry; (2) dismissedRequestsStore persists
// EVERY dismissal (accept or decline) keyed by vault+role rather than
// event id, since a relay resend or a fresh request for the same offer
// can arrive under a new event id but is still "already answered."
export function useVaultMembershipRequests(): VaultMembershipRequestsState {
  const ctx = useContext(WalletContext);
  const transport = ctx?.transport ?? null;
  const wallet = ctx?.wallet ?? null;
  const ownerId = ctx?.ownerId ?? null;
  const holdings = ctx?.holdings ?? [];
  const [requests, setRequests] = useState<readonly InboxVaultMembershipRequest[]>([]);
  const subRef = useRef<{ close(): void } | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());
  const holdingsRef = useRef(holdings);
  holdingsRef.current = holdings;

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
    void import('./vaultMembershipChannel.ts').then(({ subscribeVaultMembershipRequests }) => {
      if (cancelled) return;
      const sub = subscribeVaultMembershipRequests(transport, wallet, (item) => {
        const key = dismissKey(item.request.vault_descriptor, item.request.role);
        if (dismissedRef.current.has(key)) return;
        if (findVaultTrail(holdingsRef.current, item.request.vault_descriptor, wallet.publicKey)) {
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
    setRequests((prev) => {
      const target = prev.find((r) => r.eventId === eventId);
      if (target && ownerId) {
        const key = dismissKey(target.request.vault_descriptor, target.request.role);
        dismissedRef.current.add(key);
        void dismissedRequestsStore.add(ownerId, NAMESPACE, key);
      }
      return prev.filter((r) => r.eventId !== eventId);
    });
  };

  return { requests, dismiss };
}
