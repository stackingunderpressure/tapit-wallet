import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Attestation, FieldBranch } from 'tapit-attest';
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

function readString(claim: FieldBranch, name: string): string | undefined {
  const child = claim.children.find((c) => c.name === name);
  if (!child || child.node !== 'leaf') return undefined;
  return typeof child.value === 'string' ? child.value : undefined;
}

/**
 * A held journal attestation recording a psbt-cosign signature
 * (approveRequest.ts's buildSignedTransactionJournalFields), read back
 * out for the per-vault history below. Deliberately reads the SAME
 * fields that function writes (text, vault_descriptor, written_at) --
 * no new storage, this is the existing "every transaction you sign is
 * logged as an attested event" record, just filtered and surfaced per
 * vault instead of only in the general Journal feed.
 */
function isSignedTransactionForVault(att: Attestation, vaultDescriptor: string): boolean {
  if (att.kind !== 'journal') return false;
  const claim = att.claim as FieldBranch;
  return readString(claim, 'source') === 'psbt-cosign-signature'
    && readString(claim, 'vault_descriptor') === vaultDescriptor;
}

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
 *
 * 2026-08-15 (operator: "needs to show history of each action in each
 * vault. If you've signed anything in tap it for dynasty it shows along
 * inside vault info" -- confirmed, via chip-form, to mean inside Tapit
 * Wallet itself, not DynastyTrust's own Activity tab): each vault card
 * now has an expandable history listing every psbt-cosign signature this
 * wallet has produced for that vault, newest first, each linking to its
 * full journal entry. No new storage -- these are the same held journal
 * attestations approveRequest.ts already writes on every signature; this
 * screen is simply the first place that filters and shows them per vault
 * instead of only in the general Journal feed where they're mixed in with
 * every other kind of entry with no vault grouping at all.
 */
export function MyVaultsScreen() {
  const { wallet, ownerId, transport, holdings, refresh } = useWallet();
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);

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
          {memberships.map(({ att, id, view }) => {
            const signedEntries = holdings
              .filter((h) => isSignedTransactionForVault(h, view.vaultDescriptor))
              .sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt));
            const historyOpen = openHistoryId === id;
            return (
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
                  onClick={() => setOpenHistoryId(historyOpen ? null : id)}
                  className="mt-3 min-h-11 w-full flex items-center justify-between rounded-md border border-ink/15 px-3 text-sm font-medium hover:bg-ink/5"
                  aria-expanded={historyOpen}
                >
                  <span>
                    History{signedEntries.length > 0 ? ` (${signedEntries.length} signed)` : ''}
                  </span>
                  <span aria-hidden>{historyOpen ? '▲' : '▼'}</span>
                </button>

                {historyOpen && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted rounded-md bg-ink/[0.03] px-3 py-2">
                      <span>Accepted membership as {ROLE_LABEL[view.role] ?? view.role}</span>
                      <span>{new Date(att.issuedAt).toLocaleDateString()}</span>
                    </div>
                    {signedEntries.length === 0 ? (
                      <p className="text-xs text-muted px-3 py-1">
                        No spends signed for this vault through Tapit yet.
                      </p>
                    ) : (
                      signedEntries.map((entry) => {
                        const claim = entry.claim as FieldBranch;
                        const text = readString(claim, 'text') ?? 'Signed a Bitcoin transaction';
                        return (
                          <Link
                            key={envelopeId(entry)}
                            to={`/entry/${envelopeId(entry)}`}
                            className="flex items-center justify-between gap-2 text-xs rounded-md border border-ink/10 px-3 py-2 hover:bg-ink/5"
                          >
                            <span className="min-w-0 truncate">{text}</span>
                            <span className="shrink-0 text-muted">
                              {new Date(entry.issuedAt).toLocaleDateString()}
                            </span>
                          </Link>
                        );
                      })
                    )}
                  </div>
                )}

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
            );
          })}
        </ul>
      )}
    </div>
  );
}
