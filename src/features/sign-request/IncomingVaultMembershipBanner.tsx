import { useState } from 'react';
import { useWallet } from '../wallet-core/useWallet.ts';
import { useAnchorWorker } from '../anchoring/useAnchorWorker.ts';
import { useVaultMembershipRequests } from './useVaultMembershipRequests.ts';
import { acceptVaultMembership } from './acceptVaultMembership.ts';
import type { InboxVaultMembershipRequest } from './vaultMembershipChannel.ts';

const ROLE_LABEL: Record<string, string> = {
  founder: 'founder',
  heir: 'heir',
  protector: 'protector',
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
export function IncomingVaultMembershipBanner() {
  const { wallet, ownerId, save } = useWallet();
  const worker = useAnchorWorker();
  const { requests, dismiss } = useVaultMembershipRequests();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (requests.length === 0) return null;

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
      dismiss(item.eventId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not hold this membership.');
    } finally {
      setBusyId(null);
    }
  }

  function decline(item: InboxVaultMembershipRequest) {
    dismiss(item.eventId);
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
              className="flex-1 rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
            >
              {busyId === item.eventId ? 'Holding…' : 'Accept membership'}
            </button>
            <button
              type="button"
              onClick={() => decline(item)}
              disabled={busyId === item.eventId}
              className="rounded-md border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5"
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
