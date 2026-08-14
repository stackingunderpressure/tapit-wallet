import { encrypt, decrypt } from 'tapit-attest';
import { idb } from '../../shared/lib/idb.ts';
import { remoteRequestStateStore } from './remoteRequestStateStore.ts';

// Same namespace list dismissedRequestsStore.ts's backup functions
// use -- see that file for why one shared list beats every call site
// naming its own.
const ALL_NAMESPACES = ['psbt-cosign', 'vault-membership'] as const;

// Persisted history for incoming spend requests and vault-membership
// requests -- operator (2026-08-11, after force-quitting to confirm a
// separate bug was actually fixed): "still not showing past things in
// the inbox," naming Messages, Family & circle, AND Spend requests /
// Vault invites. Messages (messagesStore.ts) and Family & circle
// (inboxEnvelopeStore.ts) already got this exact fix on 2026-08-10 --
// that operator quote is inboxEnvelopeStore.ts's own header: "We should
// always see them till you delete them." Spend requests and vault
// invites never got the same treatment: usePsbtCosignRequests.ts and
// useVaultMembershipRequests.ts's `dismiss` only ever persisted a bare
// dismissed-KEY (dismissedRequestsStore.ts) to stop an item resurfacing
// as PENDING -- the request's actual content (who, which vault, when)
// was thrown away the moment it was reviewed/accepted/declined, with no
// way to ever see it again. This store closes that gap the same way the
// other two categories already closed it: durable, content-bearing,
// removable only by explicit delete.
//
// Unencrypted (unlike messagesStore/inboxEnvelopeStore, which hold
// relationship/chat content) -- a spend request's origin + vault name
// and a membership request's vault name + role are the same
// non-secret metadata already shown in plaintext on the live pending
// banner, no different in sensitivity from what dismissedRequestsStore
// already keeps in the clear.
export type RequestHistoryStatus = 'pending' | 'reviewed' | 'accepted' | 'declined';

export interface RequestHistoryEntry {
  /** Stable id -- the source event id for spend requests; the
   *  vault+role dismiss key for vault-membership requests (a relay
   *  resend or a fresh offer for the same role arrives under a new
   *  event id but is still the same logical history row). */
  id: string;
  summary: string;
  detail: string;
  receivedAt: number;
  status: RequestHistoryStatus;
  respondedAt: number | null;
}

const KEY = (ownerId: string, namespace: string) => `request-history:${namespace}:${ownerId}`;
// Same reasoning as processedChannelEventsStore's cap -- a long-lived
// wallet should not grow this unboundedly; oldest rows fall off first.
const MAX_ENTRIES = 200;

export const requestHistoryStore = {
  async load(ownerId: string, namespace: string): Promise<RequestHistoryEntry[]> {
    const arr = await idb.get<RequestHistoryEntry[]>(KEY(ownerId, namespace));
    return arr ?? [];
  },

  /** Insert a new entry, or replace an existing one with the same id
   *  (e.g. moving 'pending' -> 'accepted'). Newest-received-first. */
  async upsert(ownerId: string, namespace: string, entry: RequestHistoryEntry): Promise<RequestHistoryEntry[]> {
    const current = await requestHistoryStore.load(ownerId, namespace);
    const idx = current.findIndex((e) => e.id === entry.id);
    const next = idx >= 0 ? current.map((e, i) => (i === idx ? entry : e)) : [entry, ...current];
    next.sort((a, b) => b.receivedAt - a.receivedAt);
    const capped = next.slice(0, MAX_ENTRIES);
    await idb.put(KEY(ownerId, namespace), capped);
    return capped;
  },

  async remove(ownerId: string, namespace: string, id: string): Promise<RequestHistoryEntry[]> {
    const current = await requestHistoryStore.load(ownerId, namespace);
    const next = current.filter((e) => e.id !== id);
    await idb.put(KEY(ownerId, namespace), next);
    return next;
  },
};

// Cloud mirror -- same 2026-08-14 fix as dismissedRequestsStore.ts's
// backup functions, same reasoning. Pushes/restores every namespace
// this store is used under in one pass, best-effort throughout.
export async function pushRequestHistoryBackup(ownerId: string, passphrase: string): Promise<void> {
  for (const namespace of ALL_NAMESPACES) {
    const entries = await requestHistoryStore.load(ownerId, namespace);
    const bytes = new TextEncoder().encode(JSON.stringify(entries));
    const blob = encrypt(bytes, passphrase);
    await remoteRequestStateStore.put(ownerId, `request-history:${namespace}`, blob);
  }
}

export async function restoreRequestHistoryBackup(ownerId: string, passphrase: string): Promise<void> {
  for (const namespace of ALL_NAMESPACES) {
    const remoteBlob = await remoteRequestStateStore.get(ownerId, `request-history:${namespace}`);
    if (!remoteBlob) continue;
    try {
      const bytes = decrypt(remoteBlob, passphrase);
      const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (!Array.isArray(parsed)) continue;
      const local = await requestHistoryStore.load(ownerId, namespace);
      const localIds = new Set(local.map((e) => e.id));
      // Entries that already exist locally stay as-is -- this session's
      // own state is treated as fresher than a cloud snapshot. Only
      // entries genuinely missing locally (a wiped device, a fresh
      // sign-in with empty IndexedDB) get pulled back in.
      const missing = (parsed as RequestHistoryEntry[]).filter((e) => !localIds.has(e.id));
      if (missing.length === 0) continue;
      const merged = [...local, ...missing];
      merged.sort((a, b) => b.receivedAt - a.receivedAt);
      await idb.put(KEY(ownerId, namespace), merged.slice(0, MAX_ENTRIES));
    } catch {
      // best-effort -- a malformed or undecryptable remote blob leaves local state as-is
    }
  }
}
