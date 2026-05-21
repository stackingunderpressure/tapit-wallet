import { idb } from '../../shared/lib/idb.ts';

// User-level preferences. Local-only, not encrypted — these are
// settings about how the wallet behaves, not the wallet itself.
// Stored under prefs:<ownerId> so multiple accounts on the same
// browser don't trip over each other.

export interface Prefs {
  /** When false, walletStore.save() skips the Supabase write entirely. */
  cloudSync: boolean;
  /** ISO 8601 of the last successful remote save; null if never. */
  lastRemoteSync: string | null;
}

const KEY = (ownerId: string) => `prefs:${ownerId}`;

const DEFAULT_PREFS: Prefs = {
  cloudSync: true,
  lastRemoteSync: null,
};

export const prefsStore = {
  async load(ownerId: string): Promise<Prefs> {
    const found = await idb.get<Prefs>(KEY(ownerId));
    return { ...DEFAULT_PREFS, ...(found ?? {}) };
  },
  async save(ownerId: string, prefs: Prefs): Promise<void> {
    await idb.put(KEY(ownerId), prefs);
  },
};
