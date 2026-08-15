import { useEffect, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { inboxEnvelopeStore } from '../storage/inboxEnvelopeStore.ts';
import { dismissedInboxStore } from '../storage/dismissedInboxStore.ts';
import type { InboxEnvelope } from '../transport/encryptedInbox.ts';
import { envelopeId } from 'tapit-attest';

// Wire WalletProvider's inboxEnvelopes state to durable IDB storage,
// encrypted at rest with the wallet passphrase via inboxEnvelopeStore
// — same shape as useChatPersistence.ts for chat threads. Loads once
// per owner+passphrase (so prior-session arrivals reappear even when
// no relay replays them), debounce-saves on every change AFTER the
// load has resolved (the hasLoaded guard prevents an empty-state save
// at mount from racing a slow decrypt and wiping real history), and
// filters out anything already permanently dismissed so a stale saved
// copy of a dismissed row cannot resurrect it.
//
// 2026-08-15 fix (operator: "never got rid of the messages...
// spamming Home Screen every time you open app") -- the dismissed-set
// filter below used to read `dismissedRef.current` as populated by a
// completely SEPARATE effect in WalletProvider.tsx, with no ordering
// guarantee against this hook's own load. This hook now loads its own
// fresh copy of dismissedInboxStore in the same Promise.all as the
// envelope content, so the filter is never applied against a
// possibly-still-empty ref -- the same "await the restore before you
// use it" discipline already applied to the psbt-cosign/vault-
// membership channels on 2026-08-11 and 2026-08-14.
export function useInboxEnvelopePersistence(
  ownerId: string | null,
  passphrase: string | null,
  inboxEnvelopes: InboxEnvelope[],
  setInboxEnvelopes: Dispatch<SetStateAction<InboxEnvelope[]>>,
  dismissedRef: MutableRefObject<Set<string>>,
) {
  const loadedKey = useRef<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!ownerId || !passphrase) {
      setHasLoaded(false);
      loadedKey.current = null;
      return;
    }
    const key = `${ownerId}::${passphrase.length}`;
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    setHasLoaded(false);
    void Promise.all([
      inboxEnvelopeStore.load(ownerId, passphrase),
      dismissedInboxStore.load(ownerId),
    ]).then(([loaded, dismissed]) => {
      // Sync the freshly-loaded set into the shared ref too, so the
      // live-relay handler in WalletProvider benefits from whichever
      // of the two loads (this one, or its own) resolves first.
      dismissedRef.current = dismissed;
      const surviving = loaded.filter(
        (item) => !dismissed.has(envelopeId(item.envelope)),
      );
      if (surviving.length > 0) {
        setInboxEnvelopes((prev) => {
          const liveIds = new Set(prev.map((m) => m.eventId));
          const merged = [
            ...surviving.filter((m) => !liveIds.has(m.eventId)),
            ...prev,
          ];
          return merged;
        });
      }
      setHasLoaded(true);
    });
  }, [ownerId, passphrase, setInboxEnvelopes, dismissedRef]);

  useEffect(() => {
    if (!ownerId || !passphrase || !hasLoaded) return;
    const handle = setTimeout(() => {
      void inboxEnvelopeStore.save(ownerId, passphrase, inboxEnvelopes);
    }, 400);
    return () => clearTimeout(handle);
  }, [ownerId, passphrase, inboxEnvelopes, hasLoaded]);
}
