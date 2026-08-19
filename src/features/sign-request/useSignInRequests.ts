import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { WalletContext } from '../wallet-core/WalletContext.ts';
import {
  dismissedRequestsStore,
  pushDismissedRequestsBackup,
  restoreDismissedRequestsBackup,
} from '../storage/dismissedRequestsStore.ts';
import {
  requestHistoryStore,
  pushRequestHistoryBackup,
  restoreRequestHistoryBackup,
  type RequestHistoryEntry,
} from '../storage/requestHistoryStore.ts';
import { channelDiagnostics } from '../transport/channelDiagnostics.ts';
import type { InboxSignInRequest } from './signInChannel.ts';

export interface SignInRequestsState {
  requests: readonly InboxSignInRequest[];
  /** Remove a request from view once the operator has opened it to review
   *  (IncomingSignInBanner's "Review" button) -- persisted so a relay
   *  replay or a remount never brings it back looking unhandled, same
   *  fix usePsbtCosignRequests.ts already needed for the identical bug. */
  dismiss: (eventId: string) => void;
  /** Every sign-in request ever seen, pending or handled, newest first. */
  history: readonly RequestHistoryEntry[];
  /** Permanently remove one row from history. */
  deleteHistoryEntry: (id: string) => void;
}

const NAMESPACE = 'sign-in';

// Mirrors usePsbtCosignRequests.ts exactly -- same load-persisted-set-
// then-subscribe ordering (a relay backlog replay routinely beats an
// independent IDB read otherwise), same cloud-backup-restore-before-local-
// load ordering, same dismiss/history split. See that hook's header for
// the full history of bugs this exact shape already fixed once; copied
// here rather than re-derived so sign-in requests don't reintroduce them.
export function useSignInRequests(): SignInRequestsState {
  const ctx = useContext(WalletContext);
  const transport = ctx?.transport ?? null;
  const wallet = ctx?.wallet ?? null;
  const ownerId = ctx?.ownerId ?? null;
  const passphrase = ctx?.passphrase ?? null;
  const cloudSync = ctx?.prefs?.cloudSync ?? false;
  const [requests, setRequests] = useState<readonly InboxSignInRequest[]>([]);
  const [history, setHistory] = useState<readonly RequestHistoryEntry[]>([]);
  const subRef = useRef<{ close(): void } | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());
  const itemsRef = useRef<Map<string, InboxSignInRequest>>(new Map());

  const pushBackups = useCallback(() => {
    if (!ownerId || !passphrase || !cloudSync) return;
    void pushDismissedRequestsBackup(ownerId, passphrase).catch((err) => {
      console.warn('pushDismissedRequestsBackup failed; local state is still saved', err);
    });
    void pushRequestHistoryBackup(ownerId, passphrase).catch((err) => {
      console.warn('pushRequestHistoryBackup failed; local state is still saved', err);
    });
  }, [ownerId, passphrase, cloudSync]);

  useEffect(() => {
    if (!transport || !wallet || !ownerId) return;
    let cancelled = false;
    setRequests([]);
    void (async () => {
      if (ownerId && passphrase && cloudSync) {
        try {
          await Promise.all([
            restoreDismissedRequestsBackup(ownerId, passphrase),
            restoreRequestHistoryBackup(ownerId, passphrase),
          ]);
        } catch (err) {
          console.warn('restoreDismissedRequestsBackup/restoreRequestHistoryBackup failed', err);
        }
      }
      if (cancelled) return;
      const [set, loadedHistory] = await Promise.all([
        dismissedRequestsStore.load(ownerId, NAMESPACE),
        requestHistoryStore.load(ownerId, NAMESPACE),
      ]);
      if (cancelled) return;
      dismissedRef.current = set;
      setHistory(loadedHistory);
      const mod = await import('./signInChannel.ts');
      if (cancelled || !mod) return;
      const { subscribeSignInRequests } = mod;
      const sub = subscribeSignInRequests(transport, wallet, (item) => {
        itemsRef.current.set(item.eventId, item);
        if (dismissedRef.current.has(item.eventId)) {
          void channelDiagnostics.record(
            'sign-in',
            'suppressed',
            `eventId=${item.eventId.slice(0, 12)} already dismissed (reviewed earlier) -- this is the SAME request being redelivered, not a new one`,
          );
          return;
        }
        setRequests((prev) => {
          if (prev.some((r) => r.eventId === item.eventId)) return prev;
          return [...prev, item];
        });
        void requestHistoryStore.upsert(ownerId, NAMESPACE, {
          id: item.eventId,
          summary: item.request.origin,
          detail: 'Sign-in request',
          receivedAt: item.receivedAt,
          status: 'pending',
          respondedAt: null,
        }).then((next) => {
          if (!cancelled) setHistory(next);
          pushBackups();
        });
      });
      subRef.current = sub;
    })();
    return () => {
      cancelled = true;
      if (subRef.current) {
        subRef.current.close();
        subRef.current = null;
      }
    };
  }, [transport, wallet, ownerId, passphrase, cloudSync, pushBackups]);

  const dismiss = (eventId: string) => {
    if (ownerId) {
      dismissedRef.current.add(eventId);
      void dismissedRequestsStore.add(ownerId, NAMESPACE, eventId);
      const item = itemsRef.current.get(eventId);
      void requestHistoryStore.upsert(ownerId, NAMESPACE, {
        id: eventId,
        summary: item?.request.origin ?? 'Sign-in request',
        detail: 'Sign-in request',
        receivedAt: item?.receivedAt ?? Math.floor(Date.now() / 1000),
        status: 'reviewed',
        respondedAt: Math.floor(Date.now() / 1000),
      }).then((next) => {
        setHistory(next);
        pushBackups();
      });
    }
    setRequests((prev) => prev.filter((r) => r.eventId !== eventId));
  };

  const deleteHistoryEntry = (id: string) => {
    if (!ownerId) return;
    void requestHistoryStore.remove(ownerId, NAMESPACE, id).then((next) => {
      setHistory(next);
      pushBackups();
    });
  };

  return { requests, dismiss, history, deleteHistoryEntry };
}
