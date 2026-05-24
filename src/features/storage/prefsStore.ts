import { idb } from '../../shared/lib/idb.ts';
import { DEFAULT_RELAYS } from '../transport/defaultRelays.ts';

// User-level preferences. Local-only, not encrypted — these are
// settings about how the wallet behaves, not the wallet itself.
// Stored under prefs:<ownerId> so multiple accounts on the same
// browser don't trip over each other.

/**
 * The presentation skin the wallet renders under. 'classic' is the
 * original surface that shipped through Phases 1-5. 'fresh' is the
 * younger-audience theme described in the 2026-05-24 Fresh roadmap.
 * 'system' resolves to fresh on devices that report prefers-color-
 * scheme: dark and classic otherwise — chosen this way because the
 * Fresh palette is dark-default. Cryptographic core is identical
 * under every choice; only the surface differs.
 */
export type ThemeChoice = 'classic' | 'fresh' | 'system';

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
  /**
   * The wss:// URLs the Mycelium transport opens connections to.
   * Defaults to a small set of widely-used public relays (D-11a);
   * sovereign users replace it with relays they trust. Changes take
   * effect on the next transport reconnect (toggle off and on, or
   * sign out and back in).
   */
  nostrRelays: string[];
  /**
   * The active presentation theme. Default 'classic' for existing
   * wallets — the Fresh roadmap explicitly keeps Classic as default
   * until adoption signal warrants flipping it. Operator changes
   * this from Settings → Appearance.
   */
  theme: ThemeChoice;
  /**
   * When true (default), the Today tab surfaces a small "streak"
   * indicator counting consecutive days the operator has signed
   * at least one journal entry. Honest opt-out for operators
   * who read it as guilt-inducing. Only consumed under Fresh.
   */
  streaksEnabled: boolean;
  /**
   * When true (default), the Today tab surfaces a Memories strip
   * above the carousel — entries from 7, 30, and 365 days ago.
   * Per-day dismiss is handled separately in localStorage; this
   * toggle is the structural opt-out. Only consumed under Fresh.
   */
  memoriesEnabled: boolean;
}

const KEY = (ownerId: string) => `prefs:${ownerId}`;

const DEFAULT_PREFS: Prefs = {
  cloudSync: true,
  lastRemoteSync: null,
  idleTimeoutMs: 30 * 60 * 1000,
  nostrTransportEnabled: false,
  nostrRelays: [...DEFAULT_RELAYS],
  theme: 'classic',
  streaksEnabled: true,
  memoriesEnabled: true,
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
