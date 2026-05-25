import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { messagesStore } from '../storage/messagesStore.ts';
import type { ThreadMessage } from './threadMessage.ts';

// Wire the in-memory chatThreadsByPeer map to IDB persistence.
// Loads on first unlock for an owner (so prior-session messages
// reappear), debounce-saves on every state change (so a fast
// burst of messages collapses to one IDB write), and exposes a
// clear-on-sign-out path the provider can call from the session
// reset effect.
//
// Loaded-once-per-owner is tracked via a ref so a Mycelium toggle
// or any other state churn doesn't repeatedly reload from disk and
// overwrite recent in-memory state with the stale on-disk view.

export function useChatPersistence(
  ownerId: string | null,
  chatThreadsByPeer: ReadonlyMap<string, readonly ThreadMessage[]>,
  setChatThreadsByPeer: Dispatch<SetStateAction<ReadonlyMap<string, readonly ThreadMessage[]>>>,
) {
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!ownerId) return;
    if (loadedFor.current === ownerId) return;
    loadedFor.current = ownerId;
    void messagesStore.load(ownerId).then((loaded) => {
      if (loaded.size === 0) return;
      setChatThreadsByPeer((prev) => {
        // Merge on top of whatever live state already exists (e.g.
        // a message that arrived between mount and the IDB read).
        // Per-peer arrays from disk come first; live entries
        // append after, deduped by eventId where present.
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
  }, [ownerId, setChatThreadsByPeer]);

  useEffect(() => {
    if (!ownerId) return;
    if (loadedFor.current !== ownerId) return;
    const handle = setTimeout(() => {
      void messagesStore.save(ownerId, chatThreadsByPeer);
    }, 400);
    return () => clearTimeout(handle);
  }, [ownerId, chatThreadsByPeer]);
}

/**
 * Drop the IDB record for this owner — call on sign-out so the
 * next owner on the same browser does not inherit the prior chat
 * history.
 */
export async function clearPersistedChat(ownerId: string): Promise<void> {
  await messagesStore.clear(ownerId);
}
