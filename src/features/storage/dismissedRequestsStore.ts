import { idb } from '../../shared/lib/idb.ts';

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
