import { idb } from '../../shared/lib/idb.ts';

// Senders whose chat messages this wallet ignores, kept on this device only.
// Deleting a stranger's thread alone is not enough: Nostr relays replay old
// messages on every reconnect, so the spam would come straight back. Nothing
// is sent anywhere; the sender is never told.

const KEY = (ownerId: string) => `blocked-senders:${ownerId}`;

export async function loadBlockedSenders(ownerId: string): Promise<Set<string>> {
  const list = await idb.get<string[]>(KEY(ownerId));
  return new Set((list ?? []).map((k) => k.toLowerCase()));
}

export async function addBlockedSender(ownerId: string, pubkey: string): Promise<Set<string>> {
  const set = await loadBlockedSenders(ownerId);
  set.add(pubkey.toLowerCase());
  await idb.put(KEY(ownerId), [...set]);
  return set;
}
