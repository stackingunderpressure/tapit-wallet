import { createContext } from 'react';
import type { Attestation, Wallet } from 'tapit-attest';
import type { Prefs } from '../storage/prefsStore.ts';
import type { SaveOutcome } from '../storage/walletStore.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';
import type { InboxEnvelope } from '../transport/encryptedInbox.ts';
import type { PublishResult, RelayStatus, Transport } from '../transport/transport.ts';
import type { ThreadMessage } from '../messaging/threadMessage.ts';
import type { AdoptExistingKeyResult } from './adoptExistingKey.ts';

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
   * The live Mycelium peer transport, or null when the network is not
   * connected (locked, signed out, or opted out). This is the SAME
   * instance the encrypted inbox + chat subscriptions ride; features
   * that need to publish or subscribe on a sibling wire kind (e.g. the
   * liveness channel, TAPIT_LIVENESS_KIND) reuse it rather than opening
   * a second connection. A consumer MUST treat null as "no network yet"
   * and degrade gracefully — the wallet stays fully usable offline. The
   * private key never crosses this seam; the Wallet performs encryption
   * and outer signing internally.
   */
  transport: Transport | null;
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
   * Publish a PUBLIC kind-1 Nostr text note (Tier 1 item 8). World-
   * readable, signed by the wallet's real key with no encryption — the
   * opposite of sendEnvelope. Resolves with the published note event id
   * plus the relay PublishResult so the caller can record the share and
   * show honest relay-acceptance status. Throws when the transport is
   * not connected or the wallet is locked.
   */
  publishPublicNote: (
    content: string,
  ) => Promise<{ eventId: string; publish: PublishResult }>;
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
   * Switch the wallet's active signing key to an operator-supplied
   * existing key (their old Nostr nsec, as 64-char hex). Non-destructive:
   * the wallet's stable identity and all holdings are preserved via the
   * succession chain; the prior active key is retired (still able to
   * decrypt older messages) and the supplied key becomes active, so
   * future Nostr events publish under the operator's old npub. Rebuilds
   * the in-context Wallet instance and persists with K_data reuse.
   * Resolves with the adopted + retired pubkeys for confirmation UI.
   */
  adoptKey: (oldPrivateKeyHex: string) => Promise<AdoptExistingKeyResult>;
  /**
   * Remove an envelope from this wallet's holdings by its envelope id,
   * then save + refresh so the UI reflects the change. Local-only —
   * the envelope still exists for anyone who holds a copy; only this
   * wallet's view changes. Used by the operator-facing "Leave
   * organization" and "Delete organization" affordances. No-op when
   * the id is not held.
   */
  unholdEnvelope: (envelopeId: string) => Promise<void>;
  /**
   * Compound peer-removal: drop the handshake envelope from holdings
   * AND clear the chat thread with that peer in one atomic operation
   * with a single save+refresh. The chat-thread clear is keyed on the
   * peer pubkey (case-insensitive); the IDB-persistence debounce
   * picks up the shrunken Map and writes the smaller blob automatically.
   * Used by the operator-facing "Remove this person" affordance inside
   * PeerThread. Local-only — the handshake envelope still exists for
   * the peer who holds their copy; only this wallet's view changes.
   */
  removePeerConnection: (
    handshakeEnvelopeId: string,
    peerPubkey: string,
  ) => Promise<void>;
  /**
   * The currently-painted theme — 'classic' or 'fresh' — after
   * resolving the operator's prefs.theme choice (which can be
   * 'system') against the device's prefers-color-scheme. Read this
   * to gate Fresh-specific component rendering. WalletProvider is
   * the single owner of the effect that applies it to the document.
   */
  resolvedTheme: 'classic' | 'fresh';
  /**
   * Per-peer chat thread state (sub-cut 2b of the per-peer chat
   * surface roadmap). Keyed by peer pubkey; value is the
   * chronological list of inbound + outbound Tier 1 messages
   * exchanged with that peer this session. In-memory only — Cut 4
   * will refactor to IDB-paged via messagesStore.
   */
  chatThreadsByPeer: ReadonlyMap<string, readonly ThreadMessage[]>;
  /**
   * Send a Tier 1 chat message to a peer over the Mycelium
   * transport. Optimistically appends to the local thread before
   * publish settles. Returns `{}` on full success, `{ warning }`
   * when no relay acknowledged before the publish timeout but at
   * least one is still pending (the message MAY still land via a
   * slow relay), and THROWS when every relay rejected outright
   * with the optimistic record ripped out of the thread. The UI
   * surfaces `warning` as a soft inline note distinct from the
   * red-error path so the operator can tell "in-flight" from
   * "outright failed."
   */
  sendChatMessage: (
    peerPubkey: string,
    text: string,
  ) => Promise<{ warning?: string }>;
}

// Pulled into its own module so react-refresh fast-refresh works in
// the component files that consume the context.
export const WalletContext = createContext<WalletContextValue | null>(null);
