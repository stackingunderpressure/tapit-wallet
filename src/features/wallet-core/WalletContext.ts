import { createContext } from 'react';
import type { Attestation, Wallet } from 'tapit-attest';
import type { Prefs } from '../storage/prefsStore.ts';
import type { SaveOutcome } from '../storage/walletStore.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';
import type { InboxEnvelope } from '../transport/encryptedInbox.ts';

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
  /** Re-encrypt the wallet's current state and persist it. */
  save: () => Promise<SaveOutcome>;
  /** Update prefs (e.g., toggle cloud-sync). */
  updatePrefs: (next: Partial<Prefs>) => Promise<void>;
  /** Reload holdings + identity after a mutation. */
  refresh: () => Promise<void>;
}

// Pulled into its own module so react-refresh fast-refresh works in
// the component files that consume the context.
export const WalletContext = createContext<WalletContextValue | null>(null);
