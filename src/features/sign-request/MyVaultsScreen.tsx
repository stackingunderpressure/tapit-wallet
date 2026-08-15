import { useState } from 'react';
import { Link } from 'react-router-dom';
import { envelopeId } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { isVaultMembership, readVaultMembership } from './vaultTrail.ts';
import { leaveVaultMembership } from './leaveVaultMembership.ts';

const ROLE_LABEL: Record<string, string> = {
  founder: 'Founder',
  heir: 'Heir',
  protector: 'Protector',
  backup: 'Backup signer',
  consent: 'Consent signer',
  second_heir: 'Second inheritance heir',
};

/**
 * The persistent "you are a member of this vault" surface (2026-08-15,
 * operator: "you should see that you are a member of this vault and it's
 * like a green checkmark and stays that way"). Before this screen, the
 * only place a held vault-membership attestation was visible at all was
 * a debugging subsection at the bottom of Settings -> Nostr activity
 * (NostrActivitySection.tsx's "Vault memberships held") -- true but
 * effectively invisible, and its "Revoke" button only ever removed the
 * local record without telling the vault anything. This screen surfaces
 * the exact same held attestations (same isVaultMembership/
 * readVaultMembership read path) as a first-class, easy-to-find place,
 * and "Leave this vault" now goes through leaveVaultMembership.ts, which
 * also notifies the vault over Nostr so it can flag the member as
 * disconnected on its own side -- the gap the operator named directly.
 *
 * Deliberately shows every membership this wallet holds, not just ones
 * with a live psbt-cosign trail -- a member should be able to see (and
 * leave) a vault whose invite is stale or whose leaf scripts no longer
 * resolve, not just the ones currently signable.
 */
export function MyVaultsScreen() {
  const { wallet, ownerId, transport, holdings, refresh } = useWallet();
  const [leavingId, setLeavingId] = useState<string | null>(null);

  const memberships = holdings
    .filter(isVaultMembership)
    .map((att) => ({ att, id: envelopeId(att), view: readVaultMembership(att) }));

  async function leave(id: string, att: (typeof memberships)[number]['att']) {
    setLeavingId(id);
    try {
      await leaveVaultMembership(wallet, ownerId, transport, att);
      await refresh();
    } finally {
      setLeavingId(null);
    }
  }

  return (
    <div className="min-h-screen p-5 max-w-md mx-auto pb-32">
      <header className="flex items-center justify-between py-2 gap-2">
        <h1 className="text-lg font-semibold">My Vaults</h1>
        <Link to="/" className="text-sm text-muted hover:text-ink" aria-label="Back to Home">
          Home
        </Link>
      </header>

      {memberships.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Not a member of any vault yet. When a vault owner sends this wallet a membership
          invite, it shows up as a banner on Home -- accept it there and it'll appear here.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {memberships.map(({ att, id, view }) => (
            <li key={id} className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-medium truncate">
                    <span aria-hidden className="text-green-600">
                      &#10003;
                    </span>
                    {view.vaultName || 'Unnamed vault'}
                  </div>
                  <div className="mt-0.5 text-sm text-muted">
                    Member -- {ROLE_LABEL[view.role] ?? view.role}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    Accepted {new Date(att.issuedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void leave(id, att)}
                disabled={leavingId === id}
                className="mt-3 min-h-11 w-full flex items-center justify-center rounded-md border border-red-300 text-red-700 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
              >
                {leavingId === id ? 'Leaving…' : 'Leave this vault'}
              </button>
              <p className="mt-2 text-xs text-muted">
                Leaving notifies this vault so it can flag you as disconnected. It does not
                remove your key from the vault's on-chain policy -- that only happens if the
                vault owner recompiles it without you.
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
