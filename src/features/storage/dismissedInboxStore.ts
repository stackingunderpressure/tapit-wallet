import { idb } from '../../shared/lib/idb.ts';

// Persistent record of inbox envelopes the operator has dismissed for
// good. Local-only, per owner, NOT encrypted — these are stable
// envelopeId hashes (already-public content addresses), not secrets.
//
// Why this exists: the in-memory dismiss (WalletProvider's
// setInboxEnvelopes filter) only clears the row for the current
// session. The Nostr relay re-delivers every stored event on every
// wallet unlock, so a dismissed envelope reappears next session. That
// is fine for envelopes the wallet can re-suppress from holdings (a
// completed handshake the operator still holds is silent-dropped by
// findCompletedHandshakeWith), but it is the wrong answer for an
// envelope the operator has NO held copy of and never will — e.g. a
// counter-signed handshake whose peer wallet was deleted. With no held
// copy the silent-absorb path routes it to the inbox as "Absorb
// signature" forever, and Dismiss could not make it stick (operator
// field-test 2026-05-31: "still persists, it's an old handshake, I
// already deleted the test wallet it belonged to").
//
// Keyed by envelopeId (the content hash, stable across signature
// additions and across the per-relay event-id that changes on every
// rebroadcast) so dismissing one copy dismisses every relay replay of
// the same envelope. Storing eventId instead would let a re-broadcast
// under a fresh relay event-id slip past the filter.

const KEY = (ownerId: string) => `dismissed-inbox:${ownerId}`;

export const dismissedInboxStore = {
  /** The set of envelopeIds this owner has permanently dismissed. */
  async load(ownerId: string): Promise<Set<string>> {
    const arr = await idb.get<string[]>(KEY(ownerId));
    return new Set(arr ?? []);
  },

  /**
   * Mark an envelopeId permanently dismissed for this owner. Idempotent
   * — dismissing an already-dismissed id is a no-op write. Returns the
   * updated set so the caller can update in-memory state in one step.
   */
  async add(ownerId: string, envelopeId: string): Promise<Set<string>> {
    const current = await this.load(ownerId);
    if (current.has(envelopeId)) return current;
    current.add(envelopeId);
    await idb.put(KEY(ownerId), [...current]);
    return current;
  },
};
