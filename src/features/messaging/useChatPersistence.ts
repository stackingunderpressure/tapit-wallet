import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { messagesStore } from '../storage/messagesStore.ts';
import type { ThreadMessage } from './threadMessage.ts';

// Wire the in-memory chatThreadsByPeer map to IDB persistence,
// encrypted at rest with the wallet passphrase via messagesStore.
// Loads on first unlock for an owner (so prior-session messages
// reappear), debounce-saves on every state change AFTER the load
// has finished (so an empty-state save scheduled at mount time
// cannot overwrite a slow PBKDF2 decrypt that hasn't completed
// yet), and exposes a clear path the provider calls on sign-out.
//
// The hasLoaded state is the critical guard — without it the save
// effect fires its 400 ms debounce timer at mount with an empty
// chatThreadsByPeer Map, and if the operator refreshes the page
// before the encrypt-at-rest decrypt finishes the disk blob gets
// overwritten with an empty map and the message history is lost.
// hasLoaded is state (not a ref) so the save effect re-runs when
// the load resolves and re-evaluates whether to schedule a save.

export function useChatPersistence(
  ownerId: string | null,
  passphrase: string | null,
  chatThreadsByPeer: ReadonlyMap<string, readonly ThreadMessage[]>,
  setChatThreadsByPeer: Dispatch<SetStateAction<ReadonlyMap<string, readonly ThreadMessage[]>>>,
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
    void messagesStore.load(ownerId, passphrase).then((loaded) => {
      if (loaded.size > 0) {
        setChatThreadsByPeer((prev) => {
          const next = new Map(prev);
          for (const [peer, diskMsgs] of loaded.entries()) {
            const live = prev.get(peer) ?? [];
            const liveIds = new Set(live.map((m) => m.eventId).filter(Boolean));
            const merged: ThreadMessage[] = [
              ...diskMsgs.filter((m) => !m.eventId || !liveIds.has(m.eventId)),
              ...live,
            ];
            next.set(peer, merged);
          }
          return next;
        });
      }
      setHasLoaded(true);
    });
  }, [ownerId, passphrase, setChatThreadsByPeer]);

  useEffect(() => {
    if (!ownerId || !passphrase || !hasLoaded) return;
    const handle = setTimeout(() => {
      void messagesStore.save(ownerId, passphrase, chatThreadsByPeer);
    }, 400);
    return () => clearTimeout(handle);
  }, [ownerId, passphrase, chatThreadsByPeer, hasLoaded]);
}

export async function clearPersistedChat(ownerId: string): Promise<void> {
  await messagesStore.clear(ownerId);
}
