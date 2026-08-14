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
  /** Every spend request ever seen, pending or handled, newest first --
   *  operator, 2026-08-11: "still not showing past things in the
   *  inbox." Survives dismiss(): unlike the bare dismissed-key above,
   *  this keeps the actual content (who, which vault, when) so Inbox
   *  can show it as history instead of erasing it the moment it's
   *  reviewed. */
  history: readonly RequestHistoryEntry[];
  /** Permanently remove one row from history -- the only thing that
   *  should ever make a handled request disappear for good. */
  deleteHistoryEntry: (id: string) => void;
}

const NAMESPACE = 'psbt-cosign';

// Cut B stage B3, slice 1 -- "prove the pipe": subscribe to incoming
// psbt-cosign requests over Nostr and hold them in state. Reads
// wallet/transport straight from WalletContext instead of being wired
// into WalletProvider's own props/state -- WalletProvider.tsx is at its
// 800-line hard limit (per this repo's manifest doctrine), so this
// composes as an independent consumer of the existing context rather
// than growing that file by a single line.
//
// 2026-08-11 fix (found while diagnosing the identical bug reported for
// circle-phrase, "Still saying safety phrases received every time I
// open app"): loading the persisted dismiss set and opening the Nostr
// subscription used to be two INDEPENDENT effects with no ordering
// between them -- a relay backlog replay routinely beats the IDB read,
// so an already-reviewed/declined request could resurface looking
// unhandled on a fast reconnect. Collapsed into one effect that awaits
// the load before ever subscribing, so no event is handled until the
// persisted set is actually populated.
//
// 2026-08-11 follow-up, same session (operator: "still not showing past
// things in the inbox"): dismiss() used to only ever persist a bare
// dismissed-KEY -- the request's actual content (who, which vault, when)
// was thrown away the moment it was reviewed, with no way to ever see it
// again, unlike Messages/Family & circle which already got a "keep
// until you delete it" fix on 2026-08-10. requestHistoryStore.ts closes
// that gap the same way.
export function usePsbtCosignRequests(): PsbtCosignRequestsState {
  const ctx = useContext(WalletContext);
  const transport = ctx?.transport ?? null;
  const wallet = ctx?.wallet ?? null;
  const ownerId = ctx?.ownerId ?? null;
  const passphrase = ctx?.passphrase ?? null;
  const cloudSync = ctx?.prefs?.cloudSync ?? false;
  const [requests, setRequests] = useState<readonly InboxPsbtCosignRequest[]>([]);
  const [history, setHistory] = useState<readonly RequestHistoryEntry[]>([]);
  const subRef = useRef<{ close(): void } | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());
  const itemsRef = useRef<Map<string, InboxPsbtCosignRequest>>(new Map());

  // Pull any cloud-backed-up dismiss/history state down on every unlock,
  // BEFORE subscribing -- 2026-08-14, operator: "They are all old... we
  // can anticipate it would happen again" (a fresh sign-in with local
  // IndexedDB emptied had nothing to check a relay's backlog replay
  // against, so every already-reviewed request flooded back). Best-
  // effort; a failure here just means this device relies on whatever
  // it already has locally, same posture as circle-phrase's own mirror.
  useEffect(() => {
    if (!ownerId || !passphrase || !cloudSync) return;
    void Promise.all([
      restoreDismissedRequestsBackup(ownerId, passphrase),
      restoreRequestHistoryBackup(ownerId, passphrase),
    ]).catch((err) => {
      console.warn('restoreDismissedRequestsBackup/restoreRequestHistoryBackup failed', err);
    });
  }, [ownerId, passphrase, cloudSync]);

  // Mirror the freshly-updated local state to Supabase, encrypted,
  // after every write below -- best-effort, matching every other
  // cloud-backed store in this app; the stored local state is already
  // durable on this device regardless of the outcome.
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
    void Promise.all([
      dismissedRequestsStore.load(ownerId, NAMESPACE),
      requestHistoryStore.load(ownerId, NAMESPACE),
    ]).then(([set, loadedHistory]) => {
      if (cancelled) return;
      dismissedRef.current = set;
      setHistory(loadedHistory);
      return import('./psbtCosignChannel.ts');
    }).then((mod) => {
      if (cancelled || !mod) return;
      const { subscribePsbtCosignRequests } = mod;
      const sub = subscribePsbtCosignRequests(transport, wallet, (item) => {
        itemsRef.current.set(item.eventId, item);
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
        void requestHistoryStore.upsert(ownerId, NAMESPACE, {
          id: item.eventId,
          summary: item.request.origin,
          detail: item.request.vault_context.vault_name ?? '',
          receivedAt: item.receivedAt,
          status: 'pending',
          respondedAt: null,
        }).then((next) => {
          if (!cancelled) setHistory(next);
          pushBackups();
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
  }, [transport, wallet, ownerId, passphrase, cloudSync, pushBackups]);

  const dismiss = (eventId: string) => {
    if (ownerId) {
      dismissedRef.current.add(eventId);
      void dismissedRequestsStore.add(ownerId, NAMESPACE, eventId);
      const item = itemsRef.current.get(eventId);
      void requestHistoryStore.upsert(ownerId, NAMESPACE, {
        id: eventId,
        summary: item?.request.origin ?? 'Spend request',
        detail: item?.request.vault_context.vault_name ?? '',
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
