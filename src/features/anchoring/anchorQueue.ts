import { idb } from '../../shared/lib/idb.ts';
import type { Anchor } from 'tapit-attest';

// Anchor lifecycle persistence. The queue is the source of truth
// for "which attestation digests are still waiting on the OTS
// calendar." The diary entry's anchor field on its attestation is
// the snapshot; the queue is the live worklist.
//
// Each row keyed by `anchor:<ownerId>:<digestHex>` with:
//   state: queued (needs stamp) | pending (stamped, waiting confirm) | confirmed | failed
//   anchor: the latest Anchor object (matches what's on the attestation)
//   attempts: retry count for backoff
//   last_attempt: ISO timestamp of the most recent attempt

export type AnchorState = 'queued' | 'pending' | 'confirmed' | 'failed';

export interface AnchorRow {
  digestHex: string;
  state: AnchorState;
  anchor: Anchor | null;
  attempts: number;
  last_attempt: string | null;
  last_error: string | null;
}

const KEY = (ownerId: string, digestHex: string) =>
  `anchor:${ownerId}:${digestHex}`;
const INDEX_KEY = (ownerId: string) => `anchor-index:${ownerId}`;

async function readIndex(ownerId: string): Promise<string[]> {
  return (await idb.get<string[]>(INDEX_KEY(ownerId))) ?? [];
}

async function writeIndex(ownerId: string, digests: string[]): Promise<void> {
  await idb.put(INDEX_KEY(ownerId), digests);
}

export const anchorQueue = {
  async get(ownerId: string, digestHex: string): Promise<AnchorRow | undefined> {
    return idb.get<AnchorRow>(KEY(ownerId, digestHex));
  },

  async upsert(ownerId: string, row: AnchorRow): Promise<void> {
    await idb.put(KEY(ownerId, row.digestHex), row);
    const index = await readIndex(ownerId);
    if (!index.includes(row.digestHex)) {
      index.push(row.digestHex);
      await writeIndex(ownerId, index);
    }
  },

  async all(ownerId: string): Promise<AnchorRow[]> {
    const index = await readIndex(ownerId);
    const rows: AnchorRow[] = [];
    for (const digestHex of index) {
      const row = await idb.get<AnchorRow>(KEY(ownerId, digestHex));
      if (row) rows.push(row);
    }
    return rows;
  },

  async pending(ownerId: string): Promise<AnchorRow[]> {
    return (await anchorQueue.all(ownerId)).filter(
      (r) => r.state === 'queued' || r.state === 'pending' || r.state === 'failed',
    );
  },
};
