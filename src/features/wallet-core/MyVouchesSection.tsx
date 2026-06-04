import { useMemo, useState } from 'react';
import type { Attestation, Wallet } from 'tapit-attest';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';
import {
  findMyGivenVouches,
  publishRevokeReleaseAuthority,
  type GivenVouch,
} from '../identity-gate/releaseAuthorityEnvelopes.ts';

// Item 11 F (revocation) — the vouches THIS wallet has given to other
// people's gates, with a one-tap withdraw. A peer who vouched for someone
// and later changes their mind (the person's key looks compromised, the
// relationship changed) can pull their vouch; the wallet signs a revoke,
// sends it to that identity, and the operator's gate recompute drops the
// voucher (same-peer revoke-supersedes). The signed record of both the
// vouch and the withdrawal stays in this peer's holdings as an honest
// audit trail.
//
// Hidden entirely when the peer has given no vouches — most operators are
// gate-owners, not vouchers, so this section only appears for people who
// have actually been asked to vouch and did.
//
// `sendEnvelope` is threaded from the caller (it lives on the wallet
// context) so the revoke reaches the operator the same encrypted-per-peer
// way the original vouch did.

interface Props {
  wallet: Wallet;
  ownerId: string;
  anchorWorker: WorkerHandle | null;
  holdings: readonly Attestation[];
  sendEnvelope: (recipientPubkey: string, envelope: Attestation) => Promise<unknown>;
  saveAndRefresh: () => Promise<void>;
}

function shortKey(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}

export function MyVouchesSection({
  wallet,
  ownerId,
  anchorWorker,
  holdings,
  sendEnvelope,
  saveAndRefresh,
}: Props) {
  const given = useMemo(
    () => findMyGivenVouches(holdings, wallet.publicKey),
    [holdings, wallet.publicKey],
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (given.length === 0) return null;

  async function withdraw(vouch: GivenVouch) {
    setBusyId(vouch.attestId);
    setError(null);
    try {
      const revoke = await publishRevokeReleaseAuthority(
        wallet,
        ownerId,
        anchorWorker,
        vouch,
      );
      try {
        await sendEnvelope(vouch.identityPubkey, revoke);
      } catch {
        // The withdrawal is recorded locally even if the send fails; the
        // operator's gate updates when they next receive it.
      }
      await saveAndRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not withdraw the vouch.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-ink/10 bg-paper/50 p-4">
      <h3 className="text-sm font-semibold text-ink">Vouches you've given</h3>
      <p className="mt-1 text-xs text-muted">
        People you vouched for, with their gates. If your trust changes — a
        key looks compromised, the relationship changed — you can withdraw a
        vouch and their gate stops counting it.
      </p>
      <ul className="mt-3 space-y-1">
        {given.map((g) => (
          <li
            key={g.attestId}
            className="flex items-center justify-between gap-2 rounded-md bg-white/60 px-3 py-2 text-xs"
          >
            <span>
              <span className="font-mono">{shortKey(g.identityPubkey)}</span>{' '}
              <span className="text-muted">— {g.identityLeaf}</span>
              {g.withdrawn && (
                <span className="ml-1 text-amber-700">· withdrawn</span>
              )}
            </span>
            {!g.withdrawn && (
              <button
                type="button"
                onClick={() => void withdraw(g)}
                disabled={busyId === g.attestId}
                className="shrink-0 rounded border border-red-300 px-2 py-1 font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {busyId === g.attestId ? 'Withdrawing…' : 'Withdraw'}
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
