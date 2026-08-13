import { useContext, useEffect, useRef, useState } from 'react';
import { WalletContext } from '../wallet-core/WalletContext.ts';
import { findVaultTrail } from './vaultTrail.ts';
import { dismissedRequestsStore } from '../storage/dismissedRequestsStore.ts';
import { requestHistoryStore, type RequestHistoryEntry } from '../storage/requestHistoryStore.ts';
import { channelDiagnostics } from '../transport/channelDiagnostics.ts';
import type { InboxVaultMembershipRequest } from './vaultMembershipChannel.ts';

export interface VaultMembershipRequestsState {
  requests: readonly InboxVaultMembershipRequest[];
  /** Remove a request from local state once it's been accepted or
   *  declined -- there is no server-side ack to wait for; the caller
   *  (the banner) drives dismissal directly. Also persists the
   *  vault+role as durably answered so a relay replay or a fresh
   *  request for the same offer never resurfaces it. `outcome` records
   *  which actually happened, for the history entry below. */
  dismiss: (eventId: string, outcome: 'accepted' | 'declined') => void;
  /** Every membership request ever seen, pending or handled, newest
   *  first -- operator, 2026-08-11: "still not showing past things in
   *  the inbox." Keyed by vault+role (not event id) so a resend of the
   *  same offer updates the same row instead of duplicating it. */
  history: readonly RequestHistoryEntry[];
  /** Permanently remove one row from history -- the only thing that
   *  should ever make a handled request disappear for good. */
  deleteHistoryEntry: (id: string) => void;
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
//
// 2026-08-11 fix (found while diagnosing the identical bug reported for
// circle-phrase, "Still saying safety phrases received every time I
// open app"): loading the persisted dismiss set and opening the Nostr
// subscription used to be two INDEPENDENT effects with no ordering
// between them -- a relay backlog replay routinely beats the IDB read,
// so a DECLINED request (findVaultTrail's holdings check only catches
// the accepted case) could resurface looking unanswered on a fast
// reconnect. Collapsed into one effect that awaits the load before ever
// subscribing, so no event is handled until the persisted set is
// actually populated.
//
// 2026-08-11 follow-up, same session (operator: "still not showing past
// things in the inbox"): dismiss() used to only ever persist a bare
// dismissed-KEY -- the request's actual content (vault name, role, when)
// was thrown away the moment it was answered, with no way to ever see
// it again, unlike Messages/Family & circle which already got a "keep
// until you delete it" fix on 2026-08-10. requestHistoryStore.ts closes
// that gap the same way; `dismiss` now takes the real outcome instead
// of silently discarding it.
export function useVaultMembershipRequests(): VaultMembershipRequestsState {
  const ctx = useContext(WalletContext);
  const transport = ctx?.transport ?? null;
  const wallet = ctx?.wallet ?? null;
  const ownerId = ctx?.ownerId ?? null;
  const holdings = ctx?.holdings ?? [];
  const [requests, setRequests] = useState<readonly InboxVaultMembershipRequest[]>([]);
  const [history, setHistory] = useState<readonly RequestHistoryEntry[]>([]);
  const subRef = useRef<{ close(): void } | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());
  const holdingsRef = useRef(holdings);
  holdingsRef.current = holdings;
  const itemsRef = useRef<Map<string, InboxVaultMembershipRequest>>(new Map());

  useEffect(() => {
    if (!transport || !wallet || !ownerId) return;
    let cancelled = false;
    setRequests([]);
    void Promise.all([
      dismissedRequestsStore.load(ownerId, NAMESPACE),
      requestHistoryStore.load(ownerId, NAMESPACE),
    ]).then(([set, loadedHistory]) => {
      if (cancelled) return;
      dismissedRef.current = set;
      setHistory(loadedHistory);
      return import('./vaultMembershipChannel.ts');
    }).then((mod) => {
      if (cancelled || !mod) return;
      const { subscribeVaultMembershipRequests } = mod;
      const sub = subscribeVaultMembershipRequests(transport, wallet, (item) => {
        // 2026-08-11, operator: "still not seeing in inbox or banner" --
        // vaultMembershipChannel.ts already logged 'delivered' for this
        // event; both reasons it can still never become a banner are
        // recorded here, since neither is visible from the channel's own
        // decrypt-stage log. See NostrActivitySection.tsx's new "Vault
        // memberships held" list -- it's exactly the second case, made
        // checkable and revocable instead of only inferable from here.
        const key = dismissKey(item.request.vault_descriptor, item.request.role);
        itemsRef.current.set(key, item);
        if (dismissedRef.current.has(key)) {
          void channelDiagnostics.record(
            'vault-membership',
            'suppressed',
            `vault=${item.request.vault_name} role=${item.request.role} already declined earlier for this vault+role`,
          );
          return;
        }
        if (findVaultTrail(holdingsRef.current, item.request.vault_descriptor, wallet.keyHistory)) {
          void channelDiagnostics.record(
            'vault-membership',
            'suppressed',
            `vault=${item.request.vault_name} role=${item.request.role} -- this wallet ALREADY holds an accepted membership for this vault (see "Vault memberships held" above to revoke it if that's stale)`,
          );
          return;
        }
        setRequests((prev) => {
          if (prev.some((r) => r.eventId === item.eventId)) return prev;
          return [...prev, item];
        });
        void requestHistoryStore.upsert(ownerId, NAMESPACE, {
          id: key,
          summary: item.request.vault_name || 'A vault',
          detail: item.request.role,
          receivedAt: item.receivedAt,
          status: 'pending',
          respondedAt: null,
        }).then((next) => {
          if (!cancelled) setHistory(next);
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
  }, [transport, wallet, ownerId]);

  const dismiss = (eventId: string, outcome: 'accepted' | 'declined') => {
    setRequests((prev) => {
      const target = prev.find((r) => r.eventId === eventId);
      if (target && ownerId) {
        const key = dismissKey(target.request.vault_descriptor, target.request.role);
        dismissedRef.current.add(key);
        void dismissedRequestsStore.add(ownerId, NAMESPACE, key);
        const item = itemsRef.current.get(key);
        void requestHistoryStore.upsert(ownerId, NAMESPACE, {
          id: key,
          summary: item?.request.vault_name || 'A vault',
          detail: item?.request.role ?? '',
          receivedAt: item?.receivedAt ?? Math.floor(Date.now() / 1000),
          status: outcome,
          respondedAt: Math.floor(Date.now() / 1000),
        }).then((next) => setHistory(next));
      }
      return prev.filter((r) => r.eventId !== eventId);
    });
  };

  const deleteHistoryEntry = (id: string) => {
    if (!ownerId) return;
    void requestHistoryStore.remove(ownerId, NAMESPACE, id).then((next) => setHistory(next));
  };

  return { requests, dismiss, history, deleteHistoryEntry };
}
