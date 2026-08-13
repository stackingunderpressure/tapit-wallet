import { useContext, useEffect, useRef, useState } from 'react';
import { WalletContext } from '../wallet-core/WalletContext.ts';
import { storeCirclePhrasePair, pushCirclePhraseBackup, restoreCirclePhraseBackup } from './circlePhrase.ts';
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
//
// 2026-08-11 follow-up, same session (operator: "Still saying safety
// phrases received every time I open app so annoying") -- the first cut
// of this fix had a real race: loading the persisted set from IDB
// (dismissedRequestsStore.load, a real disk read) and opening the Nostr
// subscription were two INDEPENDENT effects with no ordering between
// them. A relay typically answers a backlog re-fetch fast enough to beat
// the IDB read every single time, so every replayed event arrived while
// processedRef was still its initial empty Set -- the persisted dedupe
// existed but was consistently too late to matter. Fixed by collapsing
// both into one effect that AWAITS the load before ever subscribing, so
// no event can be handled until the persisted set is actually populated.
export function useCirclePhraseDeliveries(): CirclePhraseDeliveriesState {
  const ctx = useContext(WalletContext);
  const transport = ctx?.transport ?? null;
  const wallet = ctx?.wallet ?? null;
  const ownerId = ctx?.ownerId ?? null;
  const passphrase = ctx?.passphrase ?? null;
  const cloudSync = ctx?.prefs?.cloudSync ?? false;
  const [savedVaultNames, setSavedVaultNames] = useState<readonly string[]>([]);
  const subRef = useRef<{ close(): void } | null>(null);
  const processedRef = useRef<Set<string>>(new Set());

  // Pull any cloud-backed-up phrase pairs down on every unlock, merging
  // them into local storage -- the "switched phones and lost every
  // phrase pair" case (2026-08-13, operator: "if you switch browsers or
  // phones or whatever you didn't lose anything"). Best-effort: a
  // failure here just means this device stays on whatever it already
  // has locally, same as mediaStore's remote-fallback posture.
  useEffect(() => {
    if (!ownerId || !passphrase || !cloudSync) return;
    void restoreCirclePhraseBackup(ownerId, passphrase).catch((err) => {
      console.warn('restoreCirclePhraseBackup failed; using local registry as-is', err);
    });
  }, [ownerId, passphrase, cloudSync]);

  useEffect(() => {
    if (!transport || !wallet || !ownerId) return;
    let cancelled = false;
    void dismissedRequestsStore.load(ownerId, NAMESPACE).then((set) => {
      if (cancelled) return;
      processedRef.current = set;
      return import('./circlePhraseChannel.ts');
    }).then((mod) => {
      if (cancelled || !mod) return;
      const { subscribeCirclePhraseDeliveries } = mod;
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
          // 2026-08-13 (operator: "everything should be encrypted on the
          // storage so that if you switch browsers or phones... you
          // didn't lose anything") -- mirror the freshly-updated local
          // registry to Supabase, encrypted, so a lost or switched device
          // can pull it back. Best-effort; the stored local pair is
          // already durable on this device regardless of the outcome.
          if (ownerId && passphrase && cloudSync) {
            void pushCirclePhraseBackup(ownerId, passphrase).catch((err) => {
              console.warn('pushCirclePhraseBackup failed; local pair is still saved', err);
            });
          }
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
  }, [transport, wallet, ownerId, passphrase, cloudSync]);

  return { savedVaultNames, dismiss: () => setSavedVaultNames([]) };
}
