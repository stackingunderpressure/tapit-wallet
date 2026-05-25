// One per-peer thread is a chronological list of these. Outbound
// messages append locally on send; inbound messages append via the
// WalletProvider chat subscription. Cut 4 will persist these to
// IDB; sub-cut 2b keeps them in-memory only — they live for the
// duration of an unlocked session and are dropped on lock or
// sign-out.

export interface ThreadMessage {
  /** 'out' = this wallet sent it; 'in' = peer sent it. */
  direction: 'in' | 'out';
  /** Plain UTF-8 message body. Empty allowed for future attachment-only messages. */
  text: string;
  /** Unix seconds — same units as Nostr created_at. Used for ordering and display. */
  ts: number;
  /** Peer's pubkey. For outbound this is the recipient; for inbound the sender. */
  peerPubkey: string;
  /**
   * Nostr event id. Present for inbound messages and for outbound
   * messages after publish settles. Used for dedupe — the chat
   * subscription drops events whose id already exists in the thread.
   */
  eventId?: string;
}
