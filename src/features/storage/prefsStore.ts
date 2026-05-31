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
   * ISO 8601 of the last LOCAL save. Always set when walletStore.save
   * completes, regardless of remote outcome — even when remote push
   * fails (or cloudSync is off), local saves are recorded here.
   * When lastLocalSync > lastRemoteSync the local snapshot is newer
   * than what the cloud knows about, which the home-screen banner
   * surfaces as honest UX so the operator can SEE the unsynced state
   * rather than have it lurk silently. Added 2026-05-28 (PLAN.md
   * Tier 1 item 6).
   */
  lastLocalSync: string | null;
  /**
   * ISO 8601 of the most recent remote save that was ATTEMPTED and
   * threw, or null when the most recent attempt succeeded (or none
   * has happened). walletStore.save sets this on the remote-catch
   * branch and clears it back to null on a successful remote write,
   * so it is a sticky "the cloud is actively rejecting us" flag that
   * survives reload. The home-screen backupBanner reads it as the
   * highest-priority warn case (under cloudSync-off) and paints a red
   * Retry banner — before this, a multi-day remote failure only ever
   * surfaced as the soft local-newer-than-cloud note plus the
   * day-late staleness banner, so a persistent failure could lurk
   * almost silently. Added 2026-05-31. Migration-safe: prefsStore.load
   * merges defaults under saved prefs so pre-2026-05-31 wallets
   * inherit null and the banner branch stays inactive until the next
   * failed push sets it.
   */
  lastRemoteFailedSync: string | null;
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
   * The active presentation theme. Default 'fresh' as of 2026-05-24
   * — operator flipped the default on the strength of the polish
   * arc: new wallets land on Fresh, the audience-targeted surface,
   * and Classic stays as an opt-in for operators who prefer the
   * original ink-on-paper register. Existing wallets keep their
   * saved choice because prefsStore.load merges saved prefs on top
   * of defaults, so anyone with a previously-saved theme field
   * (the vast majority) is unaffected.
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
  /**
   * The lowercase-hex pubkeys of peers the operator has opted
   * INTO their vouching circle — the eligible pool for the
   * peer-mediated identity gate (PLAN.md Founding Vision + Tier 1
   * item 11 sub-cut A, 2026-05-29). The picker surfaces candidates
   * sourced from existing trust networks (family-units, recovery
   * cohort, handshakes), the operator confirms which of those
   * are in their vouching circle, and this list persists the
   * selection. Doesn't yet do anything cryptographically — the
   * gate composition is later sub-cuts; this is the substrate
   * bootstrap step.
   */
  vouchingCirclePubkeys: string[];
}

const KEY = (ownerId: string) => `prefs:${ownerId}`;

const DEFAULT_PREFS: Prefs = {
  cloudSync: true,
  lastRemoteSync: null,
  lastLocalSync: null,
  lastRemoteFailedSync: null,
  idleTimeoutMs: 30 * 60 * 1000,
  nostrTransportEnabled: true,
  nostrRelays: [...DEFAULT_RELAYS],
  theme: 'fresh',
  streaksEnabled: true,
  memoriesEnabled: true,
  vouchingCirclePubkeys: [],
};

export const prefsStore = {
  async load(ownerId: string): Promise<Prefs> {
    const found = await idb.get<Prefs>(KEY(ownerId));
    const merged: Prefs = { ...DEFAULT_PREFS, ...(found ?? {}) };
    // Defensive recovery for wallets that previously persisted an
    // empty nostrRelays array (a race between the WalletProvider's
    // initial-state `nostrRelays: []` placeholder and any
    // updatePrefs call firing before the disk-load completes). An
    // empty relay set means the wallet has no transport substrate
    // — operator + daughter both report seeing their own messages
    // but never each other's because their wallets publish to
    // zero relays. Restore DEFAULT_RELAYS so the wallet always
    // has at least the baseline substrate to publish to + subscribe
    // on. Operators who explicitly customized their relay list and
    // intentionally have one entry stay unaffected — only literal
    // empty arrays get repaired.
    if (merged.nostrRelays.length === 0) {
      merged.nostrRelays = [...DEFAULT_RELAYS];
    }
    return merged;
  },
  async save(ownerId: string, prefs: Prefs): Promise<void> {
    await idb.put(KEY(ownerId), prefs);
  },
};
