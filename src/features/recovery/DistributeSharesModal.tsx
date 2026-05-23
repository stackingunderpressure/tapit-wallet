import { useEffect, useState } from 'react';
import { unwrapKData, type RecoverableEncryptedBlob } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { walletStore } from '../storage/walletStore.ts';
import { buildRecoveryShares, type SharePackage } from './createShares.ts';
import { findLatestCohort, readCohort } from './createCohort.ts';
import { summarizePublish } from '../transport/publishStatus.ts';

interface Props {
  onClose: () => void;
}

type RowState = 'pending' | 'sending' | 'sent' | 'failed';

interface DistributionRow {
  pkg: SharePackage;
  state: RowState;
  detail: string;
}

function shortKey(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}

// Phase 5e-iii-b-2 — distribute shares modal. After the operator has
// declared a recovery cohort (publishCohort, 5e-iii-a), this modal
// computes the N Shamir shares of K_data (the symmetric data-
// encryption key wrapped in the v2 backup blob) and sends one
// encrypted-to-recipient envelope to each cohort member via the
// Mycelium transport. Peers receive the share via their inbox and
// hold it (5e-iii-b-2 receive routing, shipped in HomeScreen).
//
// The K_data is unwrapped from the existing v2 blob using the
// operator's passphrase. Once shares are distributed, the K_data
// MUST stay stable across future saves — saveWallet's
// reuse-K_data path guarantees this. Otherwise the held shares
// would silently invalidate against the next blob.
//
// Status per peer is shown live: pending → sending → sent / failed.
// The operator can retry failed rows individually.
export function DistributeSharesModal({ onClose }: Props) {
  const { wallet, ownerId, holdings, passphrase, sendEnvelope } = useWallet();
  const [rows, setRows] = useState<DistributionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cohortAtt = findLatestCohort(holdings, wallet.identity);
        if (!cohortAtt) {
          throw new Error('No recovery cohort declared yet. Open the cohort editor first.');
        }
        const view = readCohort(cohortAtt);
        if (view.members.length === 0) {
          throw new Error('Cohort is empty — nothing to distribute.');
        }
        const stored = await walletStore.load(ownerId);
        if (!stored || stored.blob.v !== 2) {
          throw new Error(
            'Wallet backup is in legacy v1 format. Save the wallet once to upgrade to v2, then distribute again.',
          );
        }
        const kData = unwrapKData(stored.blob as RecoverableEncryptedBlob, passphrase);
        const packages = buildRecoveryShares(
          wallet,
          kData,
          view.members,
          view.threshold,
        );
        if (cancelled) return;
        setRows(packages.map((pkg) => ({ pkg, state: 'pending', detail: '' })));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'failed to prepare shares');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet, ownerId, holdings, passphrase]);

  async function sendOne(index: number) {
    setRows((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const target = next[index];
      if (!target) return prev;
      next[index] = { ...target, state: 'sending', detail: '' };
      return next;
    });
    try {
      const row = rows?.[index];
      if (!row) return;
      const publish = await sendEnvelope(row.pkg.recipient.pubkey, row.pkg.envelope);
      const summary = summarizePublish(publish);
      const accepted = summary.tone === 'ok';
      setRows((prev) => {
        if (!prev) return prev;
        const next = [...prev];
        const target = next[index];
        if (!target) return prev;
        next[index] = {
          ...target,
          state: accepted ? 'sent' : 'failed',
          detail: summary.detail,
        };
        return next;
      });
    } catch (err) {
      setRows((prev) => {
        if (!prev) return prev;
        const next = [...prev];
        const target = next[index];
        if (!target) return prev;
        next[index] = {
          ...target,
          state: 'failed',
          detail: err instanceof Error ? err.message : 'send failed',
        };
        return next;
      });
    }
  }

  async function sendAll() {
    if (!rows) return;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]?.state === 'sent') continue;
      await sendOne(i);
    }
    setAllDone(true);
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Distribute recovery shares</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">
          Each peer receives one encrypted piece of your backup's recovery key.
          A piece is useless alone — only your threshold (M of N) can put your
          key back together. The signing key is never split, only the symmetric
          data-encryption key.
        </p>

        {error && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {error}
          </div>
        )}

        {rows && (
          <>
            <ul className="mt-4 space-y-2 max-h-72 overflow-auto">
              {rows.map((row, i) => (
                <li
                  key={row.pkg.recipient.pubkey}
                  className="rounded-md border border-ink/15 bg-white px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{row.pkg.recipient.name}</div>
                      <div className="text-xs text-muted font-mono">
                        {shortKey(row.pkg.recipient.pubkey)}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full ${
                        row.state === 'sent'
                          ? 'bg-emerald-100 text-emerald-900'
                          : row.state === 'failed'
                            ? 'bg-red-100 text-red-900'
                            : row.state === 'sending'
                              ? 'bg-sky-100 text-sky-900'
                              : 'bg-ink/10 text-muted'
                      }`}
                    >
                      {row.state}
                    </span>
                  </div>
                  {row.detail && (
                    <div className="mt-1 text-[11px] text-muted">{row.detail}</div>
                  )}
                  {row.state === 'failed' && (
                    <button
                      type="button"
                      onClick={() => void sendOne(i)}
                      className="mt-2 text-xs rounded-md border border-ink/15 px-2 py-1 hover:bg-ink/5"
                    >
                      Retry
                    </button>
                  )}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => void sendAll()}
              disabled={allDone && rows.every((r) => r.state === 'sent')}
              className="mt-4 w-full rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
            >
              {allDone && rows.every((r) => r.state === 'sent')
                ? 'All shares distributed'
                : 'Send all'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
