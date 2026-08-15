import { useState } from 'react';
import { useWallet } from '../wallet-core/useWallet.ts';
import { useAnchorWorker } from '../anchoring/useAnchorWorker.ts';
import { useVaultMembershipRequests, type VaultMembershipRequestsState } from './useVaultMembershipRequests.ts';
import { acceptVaultMembership } from './acceptVaultMembership.ts';
import { sendVaultMembershipAckOverNostr } from './vaultMembershipAckChannel.ts';
import { vaultMembershipChannelStore } from './vaultMembershipChannelStore.ts';
import type { InboxVaultMembershipRequest } from './vaultMembershipChannel.ts';

const ROLE_LABEL: Record<string, string> = {
  founder: 'founder',
  heir: 'heir',
  protector: 'protector',
  backup: 'backup signer',
  consent: 'consent signer',
  second_heir: 'second inheritance heir',
};

// Cut C3's visible half. A vault owner (DynastyTrust) is asking this
// wallet to hold a membership record for a vault -- naming the vault,
// this wallet's role in it, and the exact tapscript leaf bytes its key
// appears in. Accepting mints and self-signs the attestation locally
// (acceptVaultMembership -- DynastyTrust never signs anything here); the
// wallet only recognizes future spend requests for this vault once this
// is held. Nothing is shown here to hide amount or destination decisions
// -- there are none at this step, it's purely "will you be recorded as a
// signer on this vault," the same kind of claim any other membership or
// relationship attestation makes.
//
// Mounted with no props (HomeScreen) -- owns its own
// useVaultMembershipRequests() subscription. Unchanged from before.
export function IncomingVaultMembershipBanner() {
  const state = useVaultMembershipRequests();
  return <IncomingVaultMembershipBannerView state={state} />;
}

/**
 * 2026-08-11 fix (operator: "Just received a spend request but didn't
 * show in inbox" -- the identical bug also applied here): InboxScreen.tsx
 * calls useVaultMembershipRequests() itself to know whether to render
 * "Nothing waiting," then ALSO mounted IncomingVaultMembershipBanner,
 * which called the SAME hook a second time -- two fully independent
 * subscription instances that could disagree about what had arrived.
 * This is the pure presentational half, taking already-fetched state as
 * a prop instead of calling the hook itself (a component can't call a
 * hook conditionally, so splitting fetch from render is the only way to
 * guarantee exactly one subscription on a screen that also needs the
 * count for its own empty-state text). InboxScreen.tsx calls the hook
 * once and passes the result here.
 */
export function IncomingVaultMembershipBannerView({ state }: { state: VaultMembershipRequestsState }) {
  const { wallet, ownerId, save, transport } = useWallet();
  const worker = useAnchorWorker();
  const { requests, dismiss } = state;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (requests.length === 0) return null;

  // 2026-08-11 (DynastyTrust's "return roster" request): tells the
  // vault owner's "Circle membership" tab a real decision was made,
  // instead of the grant sitting at 'sent' forever with no signal
  // either way. Best-effort -- an older request that predates
  // response_channel, or a wallet with no live transport right now,
  // simply sends no ack; the membership itself (held or not) is
  // unaffected either way, and DynastyTrust's tab just keeps showing
  // 'sent' until a later ack (if any) lands.
  async function sendAck(item: InboxVaultMembershipRequest, decision: 'accepted' | 'declined') {
    const requesterPubkey = item.request.response_channel?.requester_pubkey;
    if (!requesterPubkey || !transport) return;
    try {
      await sendVaultMembershipAckOverNostr(transport, wallet, decision, requesterPubkey);
    } catch {
      // best-effort, see comment above
    }
  }

  async function accept(item: InboxVaultMembershipRequest) {
    setError(null);
    setBusyId(item.eventId);
    try {
      await acceptVaultMembership(
        wallet,
        ownerId,
        item.request,
        async () => {
          await save();
        },
        worker,
      );
      dismiss(item.eventId, 'accepted');
      void sendAck(item, 'accepted');
      // So a later Leave action (My Vaults screen) still knows who to
      // notify -- see vaultMembershipChannelStore.ts's header for why
      // this can't just be recovered from the original request later.
      const requesterPubkey = item.request.response_channel?.requester_pubkey;
      if (requesterPubkey) {
        void vaultMembershipChannelStore.save(ownerId, item.request.vault_descriptor, requesterPubkey);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not hold this membership.');
    } finally {
      setBusyId(null);
    }
  }

  function decline(item: InboxVaultMembershipRequest) {
    dismiss(item.eventId, 'declined');
    void sendAck(item, 'declined');
  }

  return (
    <div className="mx-4 mt-4 space-y-3">
      {requests.map((item) => (
        <div
          key={item.eventId}
          className="rounded-2xl border border-accent/30 bg-accent/[0.06] p-4"
        >
          <div className="font-medium">Vault membership request</div>
          <p className="mt-1 text-sm text-muted">
            {item.request.vault_name || 'A vault'} wants this wallet recorded as a{' '}
            {ROLE_LABEL[item.request.role] ?? item.request.role}. Once held, this wallet can
            recognize and help verify real spend requests for it -- nothing is signed or spent by
            accepting.
          </p>
          <p className="mt-2 text-xs font-mono text-muted break-all">
            {item.request.vault_descriptor.slice(0, 48)}
            {item.request.vault_descriptor.length > 48 ? '…' : ''}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void accept(item)}
              disabled={busyId === item.eventId}
              className="flex-1 min-h-11 flex items-center justify-center rounded-md bg-ink text-paper text-sm font-medium disabled:opacity-40"
            >
              {busyId === item.eventId ? 'Holding…' : 'Accept membership'}
            </button>
            <button
              type="button"
              onClick={() => decline(item)}
              disabled={busyId === item.eventId}
              className="min-h-11 flex items-center justify-center rounded-md border border-ink/15 px-4 text-sm font-medium hover:bg-ink/5"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
