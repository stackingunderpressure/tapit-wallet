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
  /**
   * Milliseconds of inactivity before the wallet re-locks and the
   * passphrase prompt comes back. 0 means never (only sign-out or
   * a fresh browser session locks). Default 30 minutes per
   * DESIGN.md §5. User-configurable from Settings.
   */
  idleTimeoutMs: number;
  /**
   * When true, the wallet opens encrypted Nostr-relay connections on
   * unlock so peers can deliver attestations to it asynchronously
   * (Phase 5c). Default false because subscribing exposes the
   * wallet's pubkey to the relay set as "online" — that is a real
   * metadata leak the operator must opt into knowing about.
   */
  nostrTransportEnabled: boolean;
}

const KEY = (ownerId: string) => `prefs:${ownerId}`;

const DEFAULT_PREFS: Prefs = {
  cloudSync: true,
  lastRemoteSync: null,
  idleTimeoutMs: 30 * 60 * 1000,
  nostrTransportEnabled: false,
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
