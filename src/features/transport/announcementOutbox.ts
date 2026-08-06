import { idb } from '../../shared/lib/idb.ts';
import type { Attestation } from 'tapit-attest';

// Outbox for key-succession announcements (peer-rotation fix CUT 3,
// operator bug 2026-08-05: "her wallet didn't get my new key"). The
// prior best-effort send-and-forget (CUT 2, in RotateKeySection) meant
// an announcement a peer missed while offline was gone for good unless
// the operator noticed and manually re-announced. This queue makes an
// announcement durable: every peer it's addressed to gets its own row
// that survives app restarts, and the row stays 'pending' -- and
// therefore keeps getting retried by announcementOutboxWorker -- until
// that specific peer sends back a signed key-succession-ack
// (peerSuccession.ts) naming this envelope. Mirrors anchorQueue.ts's
// queue-plus-index shape.

export type AnnouncementOutboxState = 'pending' | 'received';

export interface AnnouncementOutboxRow {
  /** Lowercased recipient pubkey this row is addressed to. */
  peer: string;
  /** envelopeId of the announcement being delivered. */
  envelopeId: string;
  /** The signed announcement itself, so the worker can resend without rebuilding it. */
  envelope: Attestation;
  state: AnnouncementOutboxState;
  attempts: number;
  last_attempt: string | null;
  last_error: string | null;
}

const KEY = (ownerId: string, peer: string, envelopeId: string) =>
  `announcement-outbox:${ownerId}:${peer}:${envelopeId}`;
const INDEX_KEY = (ownerId: string) => `announcement-outbox-index:${ownerId}`;

async function readIndex(ownerId: string): Promise<string[]> {
  return (await idb.get<string[]>(INDEX_KEY(ownerId))) ?? [];
}

async function writeIndex(ownerId: string, keys: string[]): Promise<void> {
  await idb.put(INDEX_KEY(ownerId), keys);
}

export const announcementOutbox = {
  async upsert(ownerId: string, row: AnnouncementOutboxRow): Promise<void> {
    const key = KEY(ownerId, row.peer, row.envelopeId);
    await idb.put(key, row);
    const index = await readIndex(ownerId);
    if (!index.includes(key)) {
      index.push(key);
      await writeIndex(ownerId, index);
    }
  },

  async all(ownerId: string): Promise<AnnouncementOutboxRow[]> {
    const index = await readIndex(ownerId);
    const rows: AnnouncementOutboxRow[] = [];
    for (const key of index) {
      const row = await idb.get<AnnouncementOutboxRow>(key);
      if (row) rows.push(row);
    }
    return rows;
  },

  async pending(ownerId: string): Promise<AnnouncementOutboxRow[]> {
    return (await announcementOutbox.all(ownerId)).filter(
      (r) => r.state === 'pending',
    );
  },

  /**
   * Mark the row for this exact (peer, envelopeId) pair as received, so
   * the worker stops retrying it. No-op if no matching row exists (a
   * stray or duplicate ack, or an ack for an announcement this session
   * never sent) -- an ack must never be able to throw and disrupt
   * inbox processing.
   */
  async markReceived(
    ownerId: string,
    peer: string,
    envelopeId: string,
  ): Promise<void> {
    const key = KEY(ownerId, peer.toLowerCase(), envelopeId);
    const row = await idb.get<AnnouncementOutboxRow>(key);
    if (!row || row.state === 'received') return;
    await idb.put(key, { ...row, state: 'received', last_error: null });
  },
};
