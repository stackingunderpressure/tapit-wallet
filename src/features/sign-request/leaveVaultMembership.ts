import { envelopeId, type Attestation, type Wallet } from 'tapit-attest';
import type { Transport } from '../transport/transport.ts';
import { readVaultMembership } from './vaultTrail.ts';
import { vaultMembershipChannelStore } from './vaultMembershipChannelStore.ts';
import { sendVaultMembershipAckOverNostr } from './vaultMembershipAckChannel.ts';

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
}
