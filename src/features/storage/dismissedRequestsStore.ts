import { encrypt, decrypt } from 'tapit-attest';
import { idb } from '../../shared/lib/idb.ts';
import { remoteRequestStateStore } from './remoteRequestStateStore.ts';

// Every namespace either store in this file is used under today --
// see usePsbtCosignRequests.ts and useVaultMembershipRequests.ts.
// pushRequestStateBackup/restoreRequestStateBackup below sync all of
// them in one pass rather than making every call site name a
// namespace list of its own.
const ALL_NAMESPACES = ['psbt-cosign', 'vault-membership'] as const;

// Persistent "don't ask me again" record for incoming psbt-cosign and
// vault-membership REQUESTS -- distinct from dismissedInboxStore.ts,
// which covers the generic attestation-envelope channel (kind 9573).
// Operator, 2026-08-11: "Even after doing the work the tab acts like
// its first time. Needs to remember what you've already done." Neither
// usePsbtCosignRequests.ts nor useVaultMembershipRequests.ts persisted
// anything about a request the operator already acted on -- accepting a
// vault-membership request removed it from that session's React state
// only, and reviewing a spend request never removed it from state at
// all (IncomingPsbtCosignBanner's "Review" button only navigated). A
// relay replaying the same event, or simply remounting the subscription
// (opening a different tab and coming back), brought the whole thing
// back looking untouched.
//
// Vault-membership ACCEPT does not need an entry here -- accepting
// mints and holds a real, verified, self-signed membership attestation,
// and useVaultMembershipRequests.ts checks that directly (via
// vaultTrail.ts's findVaultTrail) before ever surfacing a request for a
// vault it already holds one for. This store exists for the cases that
// leave no holdings record: declining a vault-membership request, and
// reviewing (or declining) a psbt-cosign spend request.
//
// Keyed by a caller-chosen namespace ('psbt-cosign' | 'vault-membership')
// plus a caller-chosen key -- psbt-cosign uses the event's stable id;
// vault-membership uses `${vault_descriptor}::${role}` rather than the
// event id, since a relay resend or a fresh request for the same offer
// can arrive under a new event id but should still count as "already
// answered."
const KEY = (ownerId: string, namespace: string) => `dismissed-requests:${namespace}:${ownerId}`;

export const dismissedRequestsStore = {
  async load(ownerId: string, namespace: string): Promise<Set<string>> {
    const arr = await idb.get<string[]>(KEY(ownerId, namespace));
    return new Set(arr ?? []);
  },

  async add(ownerId: string, namespace: string, requestKey: string): Promise<Set<string>> {
    const current = await this.load(ownerId, namespace);
    if (current.has(requestKey)) return current;
    current.add(requestKey);
    await idb.put(KEY(ownerId, namespace), [...current]);
    return current;
  },
};

// Cloud mirror (2026-08-14, operator: "They are all old... we can
// anticipate it would happen again" -- a fresh sign-in with local
// IndexedDB data gone left this store with nothing to check a relay's
// routine backlog replay against, so every already-reviewed request
// flooded back looking unhandled). Pushes/restores every namespace
// this store is used under in one pass. Best-effort throughout,
// matching every other cloud mirror in this app -- local storage
// stays authoritative and fully functional offline either way.
export async function pushDismissedRequestsBackup(ownerId: string, passphrase: string): Promise<void> {
  for (const namespace of ALL_NAMESPACES) {
    const set = await dismissedRequestsStore.load(ownerId, namespace);
    const bytes = new TextEncoder().encode(JSON.stringify([...set]));
    const blob = encrypt(bytes, passphrase);
    await remoteRequestStateStore.put(ownerId, `dismissed-requests:${namespace}`, blob);
  }
}

export async function restoreDismissedRequestsBackup(ownerId: string, passphrase: string): Promise<void> {
  for (const namespace of ALL_NAMESPACES) {
    const remoteBlob = await remoteRequestStateStore.get(ownerId, `dismissed-requests:${namespace}`);
    if (!remoteBlob) continue;
    try {
      const bytes = decrypt(remoteBlob, passphrase);
      const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (!Array.isArray(parsed)) continue;
      const local = await dismissedRequestsStore.load(ownerId, namespace);
      let changed = false;
      for (const key of parsed) {
        if (typeof key === 'string' && !local.has(key)) {
          local.add(key);
          changed = true;
        }
      }
      if (changed) await idb.put(KEY(ownerId, namespace), [...local]);
    } catch {
      // best-effort -- a malformed or undecryptable remote blob leaves local state as-is
    }
  }
}
