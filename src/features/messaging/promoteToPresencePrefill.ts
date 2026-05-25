import type { PromotePayload } from './promoteTarget.ts';

// Map a promote-to-envelope payload from PeerThread into the shape
// MarkPresenceModal.prefill accepts. Sibling to
// promoteToJournalPrefill. Sub-cut 2c's second target: the operator
// long-presses a chat moment or taps the plus-menu's "Mark
// presence with this person" and lands on MarkPresenceModal with
// the peer's pubkey + display name pre-filled so the captured
// presence event records who they were with as signed leaves
// (with_peer_id + with_peer_name) — not just a solo "I was here."
//
// The chat sourceText is deliberately NOT carried into the presence
// event. Presence is a structural attestation about a moment in
// space-time; the chat text is conversational ephemera. If the
// operator wants the chat text preserved as a record, the journal
// target is the right path.

export interface PresencePrefill {
  peerPubkey: string;
  peerName: string;
}

export function promoteToPresencePrefill(payload: PromotePayload): PresencePrefill {
  return {
    peerPubkey: payload.peerPubkey,
    peerName: payload.peerName,
  };
}
