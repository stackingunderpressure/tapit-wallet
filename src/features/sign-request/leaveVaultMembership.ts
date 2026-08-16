import { envelopeId, type Attestation, type Wallet } from 'tapit-attest';
import type { Transport } from '../transport/transport.ts';
import { readVaultMembership } from './vaultTrail.ts';
import { vaultMembershipChannelStore } from './vaultMembershipChannelStore.ts';
import { sendVaultMembershipAckOverNostr } from './vaultMembershipAckChannel.ts';
import { dismissedRequestsStore } from '../storage/dismissedRequestsStore.ts';
import { NAMESPACE, dismissKey } from './useVaultMembershipRequests.ts';

/**
 * Leave a vault this wallet holds a membership attestation for
 * (2026-08-15, operator: "say you want to disengage from it and you want
 * to delete yourself from it, then it would notify Dynasty Trust that you
 * have a trustee that's disconnected"). Shared by the My Vaults screen's
 * "Leave this vault" button and Settings' "Vault memberships held" list
 * (NostrActivitySection.tsx), which already had a local-only "Revoke"
 * doing the unhold half of this -- this adds the notify half so
 * DynastyTrust's Circle membership tab actually learns about it, instead
 * of silently showing "Accepted" forever after a local-only revoke.
 *
 * Soft disconnect only, matching the operator's chosen semantics: this
 * removes the LOCAL record and tells DynastyTrust to flag the member as
 * disconnected. It does not and cannot revoke on-chain spending power --
 * the member's key is baked into the vault's already-compiled Taproot
 * script and stays a valid signer until DynastyTrust actually recompiles
 * the vault without them.
 *
 * The Nostr notification is best-effort (no transport, no stored channel
 * from accept time, or the send simply fails) -- leaving locally must
 * still succeed either way; see vaultMembershipChannelStore.ts's header
 * for why the channel might be missing (an attestation held before
 * 2026-08-15, or accepted on a different device).
 *
 * 2026-08-17 fix (operator: "when you leave a vault it then still
 * receive the Nostr message and it wants you to rejoin again... needs
 * to ignore the message unless new messages sent"). Before this,
 * unhold() was the ONLY thing standing between the wallet and a
 * resurfaced "Accept/Decline" prompt: useVaultMembershipRequests.ts's
 * suppression relies on findVaultTrail matching a HELD attestation
 * (dismissedRequestsStore.ts's own header explains accept never needed
 * a dismiss entry for exactly this reason), and leaving unholds that
 * exact attestation -- so a relay replaying the original invite, or
 * DynastyTrust's own outbox retrying a send to a member it doesn't yet
 * know left, sailed straight past that check and looked like a brand
 * new invite. This now writes the SAME dismissedRequestsStore entry
 * `dismiss()` already writes for a decline (keyed by vault+role, not
 * event id, so it survives a resend under a new event id) -- leaving
 * behaves exactly like declining for suppression purposes. If
 * DynastyTrust genuinely re-invites this wallet to the SAME vault+role
 * later, that still arrives as a fresh request under this same key and
 * is suppressed too, matching how a decline already works today; there
 * is no separate "un-suppress" escape hatch yet.
 */
export async function leaveVaultMembership(
  wallet: Wallet,
  ownerId: string,
  transport: Transport | null,
  att: Attestation,
): Promise<void> {
  const view = readVaultMembership(att);
  const channel = await vaultMembershipChannelStore.get(ownerId, view.vaultDescriptor);
  if (channel && transport) {
    try {
      await sendVaultMembershipAckOverNostr(transport, wallet, 'left', channel.requesterPubkey);
    } catch {
      // best-effort, see header
    }
  }
  await wallet.unhold(envelopeId(att));
  await dismissedRequestsStore.add(ownerId, NAMESPACE, dismissKey(view.vaultDescriptor, view.role));
}
