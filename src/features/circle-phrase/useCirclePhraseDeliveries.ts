import { useContext, useEffect, useRef, useState } from 'react';
import { WalletContext } from '../wallet-core/WalletContext.ts';
import { storeCirclePhrasePair } from './circlePhrase.ts';
import { sendCirclePhraseAckOverNostr } from './circlePhraseAckChannel.ts';
import { dismissedRequestsStore } from '../storage/dismissedRequestsStore.ts';
import type { InboxCirclePhraseDelivery } from './circlePhraseChannel.ts';

const NAMESPACE = 'circle-phrase';

export interface CirclePhraseDeliveriesState {
  /** Vault names received during this session, purely so a toast/banner
   *  can say "saved" -- never the phrases themselves. */
  savedVaultNames: readonly string[];
  /** Clear the banner. Session-only (the persisted per-event dedupe
   *  below is what actually stops a relay replay from bringing it back,
   *  not this) -- safe to call any time the operator wants it gone. */
  dismiss: () => void;
}

// Reads wallet/transport straight from WalletContext instead of being wired
// into WalletProvider's own props/state -- WalletProvider.tsx is at its
// 800-line hard limit (per this repo's manifest doctrine), same reasoning
// usePsbtCosignRequests.ts already documents.
//
// Unlike usePsbtCosignRequests (deliberately receive-only, "prove the
// pipe"), this hook stores immediately on receipt: a phrase pair has no
// approval step, and the whole point is that the plaintext never lingers
// anywhere longer than it takes to hash it (circlePhrase.ts).
//
// 2026-08-11 fix (operator, seeing "Tapit Circle" repeated six times in
// the saved-banner on every single app open): subscribeCirclePhraseDeliveries
// subscribes with no `since` cutoff (by design -- a key rotation needs the
// full history re-checked), so a relay re-serves its whole matching
// backlog on every fresh subscribe (app reopen, tab refocus). The old
// `seenRef` dedupe was an in-memory Set that reset to empty on every
// mount, so it did nothing across app restarts -- every historical
// delivery (six, from a day of testing resends) replayed and re-appended
// to the banner list every time. This is the exact same root cause
// dismissedRequestsStore.ts's own header documents for psbt-cosign and
// vault-membership ("Even after doing the work the tab acts like its
// first time"), just never applied here. Reused directly (new namespace
// 'circle-phrase', keyed by the event's own id) rather than inventing a
// parallel store -- a stored phrase pair has no "still pending" state
// the way an unanswered request does, so unlike
// processedChannelEventsStore.ts (which deliberately only covers
// permanent FAILURES, never successes), it's correct here to persist the
// success case forever: once an event id is processed, replaying it can
// never do anything different.
export function useCirclePhraseDeliveries(): CirclePhraseDeliveriesState {
  const ctx = useContext(WalletContext);
  const transport = ctx?.transport ?? null;
  const wallet = ctx?.wallet ?? null;
  const ownerId = ctx?.ownerId ?? null;
  const [savedVaultNames, setSavedVaultNames] = useState<readonly string[]>([]);
  const subRef = useRef<{ close(): void } | null>(null);
  const processedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!ownerId) {
      processedRef.current = new Set();
      return;
    }
    let alive = true;
    void dismissedRequestsStore.load(ownerId, NAMESPACE).then((set) => {
      if (alive) processedRef.current = set;
    });
    return () => {
      alive = false;
    };
  }, [ownerId]);

  useEffect(() => {
    if (!transport || !wallet || !ownerId) return;
    let cancelled = false;
    void import('./circlePhraseChannel.ts').then(({ subscribeCirclePhraseDeliveries }) => {
      if (cancelled) return;
      const sub = subscribeCirclePhraseDeliveries(transport, wallet, (item: InboxCirclePhraseDelivery) => {
        if (processedRef.current.has(item.eventId)) return;
        processedRef.current.add(item.eventId);
        void dismissedRequestsStore.add(ownerId, NAMESPACE, item.eventId);
        void storeCirclePhrasePair({
          vaultDescriptor: item.delivery.vault_descriptor,
          vaultName: item.delivery.vault_name || 'a vault',
          normalPhrase: item.delivery.normal_phrase,
          duressPhrase: item.delivery.duress_phrase,
        }).then(() => {
          setSavedVaultNames((prev) => [...prev, item.delivery.vault_name || 'a vault']);
          // 2026-08-11 (DynastyTrust operator: "message couldn't drop in
          // that situation") -- confirm real receipt back to the sender
          // now that the pair is actually stored, not merely that a
          // relay accepted the original publish. Best-effort, matching
          // the response-channel precedent (psbtCosignResponseChannel.ts,
          // vaultMembershipAckChannel.ts): an older delivery with no
          // response_channel, or no live transport right now, just sends
          // no ack -- the stored pair itself is unaffected either way.
          const requesterPubkey = item.delivery.response_channel?.requester_pubkey;
          if (requesterPubkey && transport && wallet) {
            void sendCirclePhraseAckOverNostr(transport, wallet, requesterPubkey).catch(() => {
              // best-effort, see comment above
            });
          }
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

  return { savedVaultNames, dismiss: () => setSavedVaultNames([]) };
}
