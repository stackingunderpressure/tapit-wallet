import { useEffect, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { inboxEnvelopeStore } from '../storage/inboxEnvelopeStore.ts';
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
export function useInboxEnvelopePersistence(
  ownerId: string | null,
  passphrase: string | null,
  inboxEnvelopes: InboxEnvelope[],
  setInboxEnvelopes: Dispatch<SetStateAction<InboxEnvelope[]>>,
  dismissedRef: RefObject<Set<string>>,
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
    void inboxEnvelopeStore.load(ownerId, passphrase).then((loaded) => {
      const surviving = loaded.filter(
        (item) => !dismissedRef.current?.has(envelopeId(item.envelope)),
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
