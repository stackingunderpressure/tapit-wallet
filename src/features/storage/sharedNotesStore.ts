import { idb } from '../../shared/lib/idb.ts';

// Local record of which journal entries have been shared to Nostr as a
// public kind-1 note, and the resulting note event id (PLAN.md Tier 1
// item 8, 2026-06-01). Per owner, NOT encrypted — these are public
// note event ids + the public envelopeIds of entries the operator
// chose to broadcast, not secrets.
//
// Why a side store instead of stamping the entry. A tapit-attest
// attestation's envelopeId is the hash of its signed content; adding a
// "published_note_id" leaf would change the envelopeId and break the
// entry's identity (and its anchor, its disclosure proofs, every
// reference to it). So the share record lives beside the entry, keyed
// by the entry's stable envelopeId, exactly the pattern
// dismissedInboxStore uses for the inbox.
//
// Map shape: { [entryEnvelopeId]: noteEventId }. The presence of a key
// means "shared"; the value is the kind-1 event id so the UI can show
// "shared" state and, later, build a link to it.

const KEY = (ownerId: string) => `shared-notes:${ownerId}`;

type ShareMap = Record<string, string>;

export const sharedNotesStore = {
  /** Load the full entryId -> noteEventId map for this owner. */
  async load(ownerId: string): Promise<ShareMap> {
    return (await idb.get<ShareMap>(KEY(ownerId))) ?? {};
  },

  /**
   * Record that an entry was shared, with the published note's event
   * id. Idempotent-ish: re-sharing overwrites with the latest note id
   * (a re-share publishes a new note). Returns the updated map.
   */
  async markShared(
    ownerId: string,
    entryEnvelopeId: string,
    noteEventId: string,
  ): Promise<ShareMap> {
    const current = await this.load(ownerId);
    current[entryEnvelopeId] = noteEventId;
    await idb.put(KEY(ownerId), current);
    return current;
  },
};
