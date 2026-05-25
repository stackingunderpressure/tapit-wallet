import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { messagesStore } from '../storage/messagesStore.ts';
import type { ThreadMessage } from './threadMessage.ts';

// Wire the in-memory chatThreadsByPeer map to IDB persistence,
// encrypted at rest with the wallet passphrase via messagesStore.
// Loads on first unlock for an owner (so prior-session messages
// reappear), debounce-saves on every state change (so a fast burst
// of messages collapses to one PBKDF2-AES encrypt + IDB write), and
// exposes a clear path the provider calls on sign-out.
//
// Loaded-once-per-(owner, passphrase) is tracked via a ref so a
// Mycelium toggle, a theme change, or any other state churn doesn't
// repeatedly reload from disk and overwrite recent in-memory state
// with the stale on-disk view. If the passphrase changes (rotation,
// re-unlock cycle), the load runs again under the new credential.

export function useChatPersistence(
  ownerId: string | null,
  passphrase: string | null,
  chatThreadsByPeer: ReadonlyMap<string, readonly ThreadMessage[]>,
  setChatThreadsByPeer: Dispatch<SetStateAction<ReadonlyMap<string, readonly ThreadMessage[]>>>,
) {
  const loadedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!ownerId || !passphrase) return;
    const key = `${ownerId}::${passphrase.length}`;
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    void messagesStore.load(ownerId, passphrase).then((loaded) => {
      if (loaded.size === 0) return;
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
    });
  }, [ownerId, passphrase, setChatThreadsByPeer]);

  useEffect(() => {
    if (!ownerId || !passphrase) return;
    if (loadedKey.current !== `${ownerId}::${passphrase.length}`) return;
    const handle = setTimeout(() => {
      void messagesStore.save(ownerId, passphrase, chatThreadsByPeer);
    }, 400);
    return () => clearTimeout(handle);
  }, [ownerId, passphrase, chatThreadsByPeer]);
}

export async function clearPersistedChat(ownerId: string): Promise<void> {
  await messagesStore.clear(ownerId);
}
