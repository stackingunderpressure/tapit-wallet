import { createContext } from 'react';
import type { Attestation, Wallet } from 'tapit-attest';
import type { Prefs } from '../storage/prefsStore.ts';
import type { SaveOutcome } from '../storage/walletStore.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';
import type { InboxEnvelope } from '../transport/encryptedInbox.ts';
import type { PublishResult, RelayStatus } from '../transport/transport.ts';

export interface WalletContextValue {
  wallet: Wallet;
  ownerId: string;
  /**
   * The unlock passphrase, held in memory across the session so
   * holdings-changing operations (sign + save + media encrypt) can
   * run without re-prompting. Cleared on sign-out. Never persisted,
   * logged, or sent across the network. Same lifetime as the
   * unlocked-wallet state itself.
   */
  passphrase: string;
  holdings: Attestation[];
  identity: Attestation | null;
  prefs: Prefs;
  /** Anchor lifecycle worker for this session. Null while idle. */
  anchorWorker: WorkerHandle | null;
  /**
   * Encrypted envelopes received from peers through the Nostr
   * transport since unlock. Empty while the Mycelium-network
   * preference is off. Each item is verified + decrypted + parsed
   * before it reaches this list.
   */
  inboxEnvelopes: InboxEnvelope[];
  /** Drop one inbox envelope by event id (e.g. after the operator acts on it). */
  dismissInboxEnvelope: (eventId: string) => void;
  /**
   * Current Mycelium-transport relay status snapshot. Null when the
   * operator has not opted into the network — UI uses this to render
   * a live indicator that hides entirely when Mycelium is off.
   */
  relayStatus: readonly RelayStatus[] | null;
  /**
   * Encrypt an envelope to a peer's x-only pubkey, publish it through
   * the Mycelium transport, and wait for relay acks. Resolves with a
   * PublishResult naming how many relays accepted, rejected, or were
   * still pending at the publish timeout — the caller decides how to
   * surface that. Throws if the network is not connected. The
   * wallet's private key never crosses this seam — encryption +
   * signing happen inside the Wallet instance.
   */
  sendEnvelope: (recipientPubkey: string, envelope: Attestation) => Promise<PublishResult>;
  /**
   * Multi-device sync (5c-iii-b). Publish an envelope encrypted to
   * this wallet's own pubkey so other devices catch it through their
   * inbox subscription. Returns null when the Mycelium network is
   * not connected — sync is opportunistic; callers do not need to
   * gate on it. The other devices' inbox handler auto-holds the
   * envelope without UI surfacing.
   */
  syncEnvelope: (envelope: Attestation) => Promise<PublishResult | null>;
  /** Re-encrypt the wallet's current state and persist it. */
  save: () => Promise<SaveOutcome>;
  /** Update prefs (e.g., toggle cloud-sync). */
  updatePrefs: (next: Partial<Prefs>) => Promise<void>;
  /** Reload holdings + identity after a mutation. */
  refresh: () => Promise<void>;
  /**
   * The currently-painted theme — 'classic' or 'fresh' — after
   * resolving the operator's prefs.theme choice (which can be
   * 'system') against the device's prefers-color-scheme. Read this
   * to gate Fresh-specific component rendering. WalletProvider is
   * the single owner of the effect that applies it to the document.
   */
  resolvedTheme: 'classic' | 'fresh';
}

// Pulled into its own module so react-refresh fast-refresh works in
// the component files that consume the context.
export const WalletContext = createContext<WalletContextValue | null>(null);
