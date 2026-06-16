import { encrypt, decrypt, type Attestation, type EncryptedBlob } from 'tapit-attest';
import { idb } from '../../shared/lib/idb.ts';

// Local persistence for FRIENDS' family trees received over the network. A
// friend taps "Share my family tree with you"; their bundle arrives through
// the encrypted inbox and lands HERE — encrypted at rest with the wallet
// passphrase via tapit-attest's encrypt/decrypt (PBKDF2-AES), the same posture
// secretsLedgerStore / walletStore / messagesStore use. A decrypt failure
// (wrong passphrase, corrupt blob, version skew) returns an empty list rather
// than throwing, so a boot-race resolves to "no trees yet" instead of crashing.
//
// PRIVACY RAIL #2: a received friend-tree lives ONLY here. It is NEVER passed
// to wallet.hold and NEVER mixed into the operator's own holdings or kin graph.
// The operator's own tree is built only from their wallet's holdings; this
// store is read separately and rendered strictly read-only. Deleting this
// store leaves the operator's own tree completely intact.
//
// Records are keyed by the SENDER pubkey: a fresh share from the same friend
// replaces their older one (upsertByFromPubkey), so the view shows the latest
// tree each friend shared rather than accreting stale duplicates.

export interface ForeignTreeRecord {
  /** The envelope signer — the friend's identity pubkey (provenance). */
  fromPubkey: string;
  /** The friend's display name, for the provenance banner. */
  sharerName: string;
  /** The friend's own self person-node id, to root the read-only canvas. */
  rootNodeId: string | null;
  /** ISO 8601 — when the friend signed the share (the share moment). */
  sharedAt: string;
  /** The friend's family-tree attestations (person-nodes / kin-edges / edits). */
  trees: Attestation[];
}

const KEY = (ownerId: string) => `foreign-trees:${ownerId}`;

function encodeRecords(records: readonly ForeignTreeRecord[]): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(records));
}

function decodeRecords(bytes: Uint8Array): ForeignTreeRecord[] {
  const text = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(text) as unknown;
  return Array.isArray(parsed) ? (parsed as ForeignTreeRecord[]) : [];
}

/**
 * Replace any existing record from the same sender with `incoming` (matched
 * case-insensitively on fromPubkey), else append it. Pure — returns a new
 * array; the caller persists with save. The latest share from a friend wins
 * so re-sharing an updated tree does not double the friend in the list.
 */
export function upsertByFromPubkey(
  records: readonly ForeignTreeRecord[],
  incoming: ForeignTreeRecord,
): ForeignTreeRecord[] {
  const lower = incoming.fromPubkey.toLowerCase();
  const without = records.filter((r) => r.fromPubkey.toLowerCase() !== lower);
  return [...without, incoming];
}

export const foreignTreesStore = {
  async load(ownerId: string, passphrase: string): Promise<ForeignTreeRecord[]> {
    const blob = await idb.get<EncryptedBlob>(KEY(ownerId));
    if (!blob) return [];
    try {
      return decodeRecords(decrypt(blob, passphrase));
    } catch (err) {
      console.warn('foreignTreesStore.load decrypt failed — returning empty', err);
      return [];
    }
  },

  async save(
    ownerId: string,
    passphrase: string,
    records: readonly ForeignTreeRecord[],
  ): Promise<void> {
    const blob = encrypt(encodeRecords(records), passphrase);
    await idb.put(KEY(ownerId), blob);
  },

  /**
   * Convenience: load the current set, upsert the incoming record by sender,
   * and persist in one call. Used by the inbox handler's silent friend-tree
   * branch so a received bundle is absorbed with zero operator chore.
   */
  async upsert(
    ownerId: string,
    passphrase: string,
    incoming: ForeignTreeRecord,
  ): Promise<void> {
    const records = await this.load(ownerId, passphrase);
    await this.save(ownerId, passphrase, upsertByFromPubkey(records, incoming));
  },

  async clear(ownerId: string): Promise<void> {
    await idb.delete(KEY(ownerId));
  },
};
