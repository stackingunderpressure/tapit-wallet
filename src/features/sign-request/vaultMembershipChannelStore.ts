import { idb } from '../../shared/lib/idb.ts';

/**
 * Persists the ephemeral reply pubkey a vault-membership request arrived
 * on (`request.response_channel.requester_pubkey`), keyed by vault
 * descriptor, at the moment this wallet accepts. vaultMembershipAckChannel.ts
 * already sends an accept ack using that pubkey, but only had it in scope
 * for the single request/response round trip -- nothing kept it around.
 *
 * 2026-08-15 (operator: "say you want to disengage from it and you want
 * to delete yourself from it, then it would notify Dynasty Trust that
 * you have a trustee that's disconnected"): leaving a vault can happen
 * days or months after accepting, from the My Vaults screen, long after
 * the original request event and its banner are gone. Without this
 * store there would be no reply pubkey left to address a 'left' ack to,
 * and DynastyTrust's side would just never learn the member walked away.
 *
 * Deliberately local-only, no cloud-mirror backup (contrast
 * dismissedRequestsStore.ts's pushDismissedRequestsBackup): losing this
 * on a fresh sign-in only means a later Leave action can't notify
 * DynastyTrust over Nostr, not that leaving silently fails or that any
 * security property is affected -- what actually gates signing is
 * leaveVaultMembership.ts's wallet.unhold() call, which removes the
 * membership attestation findVaultTrail (vaultTrail.ts) requires before
 * signPsbtCosign will sign anything for that vault, regardless of
 * whether this store has an entry.
 *
 * (Correction, 2026-08-17: this comment used to name a leftVaultsStore.ts
 * as the thing gating signing -- no such file was ever built, this was
 * stale/aspirational text. leaveVaultMembership.ts's own header now
 * documents the real fix for the companion problem that file was meant
 * to solve: unholding alone stops SIGNING but does nothing to stop a
 * replayed or re-sent invite from resurfacing as a fresh Accept/Decline
 * prompt, which is now handled by writing a dismissedRequestsStore
 * entry instead.)
 */
const KEY = (ownerId: string) => `vault-membership-channel:${ownerId}`;

export interface VaultMembershipChannelEntry {
  requesterPubkey: string;
  acceptedAt: number;
}

async function loadAll(ownerId: string): Promise<Record<string, VaultMembershipChannelEntry>> {
  return (await idb.get<Record<string, VaultMembershipChannelEntry>>(KEY(ownerId))) ?? {};
}

export const vaultMembershipChannelStore = {
  async save(ownerId: string, vaultDescriptor: string, requesterPubkey: string): Promise<void> {
    const all = await loadAll(ownerId);
    all[vaultDescriptor] = { requesterPubkey, acceptedAt: Date.now() };
    await idb.put(KEY(ownerId), all);
  },

  async get(ownerId: string, vaultDescriptor: string): Promise<VaultMembershipChannelEntry | null> {
    const all = await loadAll(ownerId);
    return all[vaultDescriptor] ?? null;
  },
};
