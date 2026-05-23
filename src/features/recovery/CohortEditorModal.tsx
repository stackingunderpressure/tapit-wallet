import { useState, useMemo } from 'react';
import { useWallet } from '../wallet-core/useWallet.ts';
import { isHandshake, readHandshake } from '../connections/createHandshake.ts';
import {
  findLatestCohort,
  publishCohort,
  readCohort,
  type CohortMember,
} from './createCohort.ts';
import { DistributeSharesModal } from './DistributeSharesModal.tsx';

interface Props {
  onClose: () => void;
}

function shortKey(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}

// 5e-iii-a — cohort editor. Picks members from existing handshakes
// (the same web the spec promises is "the network of this document,
// used backwards") and sets (M, N) threshold. Publishes a self-
// signed recovery-cohort credential. Does NOT distribute shares
// yet — that ships in 5e-iii-b alongside backup-format v2.
//
// totalShares == members.length by construction in this UI — the
// operator picks N peers and the wallet records exactly N. M is
// the slider 2..N. Defaults proposed: N=5 M=3 operator-grade per
// the brief.
export function CohortEditorModal({ onClose }: Props) {
  const { wallet, ownerId, holdings, anchorWorker, save, refresh } = useWallet();

  // Build the candidate pool: every peer this wallet has handshaken
  // with, deduped, with their name from the signed leaves.
  const candidates = useMemo(() => {
    const map = new Map<string, CohortMember>();
    for (const a of holdings) {
      if (!isHandshake(a)) continue;
      const v = readHandshake(a);
      if (v.initiatorId && v.initiatorId !== wallet.identity) {
        if (!map.has(v.initiatorId)) {
          map.set(v.initiatorId, { pubkey: v.initiatorId, name: v.initiatorName || 'Unknown' });
        }
      }
      if (v.responderId && v.responderId !== wallet.identity) {
        if (!map.has(v.responderId)) {
          map.set(v.responderId, { pubkey: v.responderId, name: v.responderName || 'Unknown' });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [holdings, wallet.identity]);

  const currentCohort = findLatestCohort(holdings, wallet.identity);
  const initialView = currentCohort ? readCohort(currentCohort) : null;
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set((initialView?.members ?? []).map((m) => m.pubkey)),
  );
  const [threshold, setThreshold] = useState<number>(initialView?.threshold ?? 3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [distributeOpen, setDistributeOpen] = useState(false);

  const N = selected.size;
  const thresholdClamped = Math.max(2, Math.min(N, threshold));

  function toggle(pubkey: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pubkey)) next.delete(pubkey);
      else next.add(pubkey);
      return next;
    });
  }

  async function publish() {
    setError(null);
    if (N < 2) {
      setError('Pick at least 2 peers — a 2-of-2 cohort is the smallest meaningful threshold.');
      return;
    }
    if (N > 255) {
      setError('Cohort cannot exceed 255 members.');
      return;
    }
    setBusy(true);
    try {
      const members = candidates.filter((c) => selected.has(c.pubkey));
      await publishCohort(wallet, ownerId, anchorWorker, members, thresholdClamped, N);
      await save();
      await refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'publish failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Recovery cohort</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">
          Pick the people you would trust to help you recover this wallet
          on a new device. Any M of N of them will be able to put you back
          together. They never see anything of yours on their own — only
          combined.
        </p>
        <p className="mt-2 text-xs text-muted">
          This cut records WHO. Distributing shares + the actual
          recoverable backup wiring lands in the next cut.
        </p>

        {candidates.length === 0 ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            No handshakes on file. Meet someone in person and tap New
            handshake on the People tab; once you have at least 2
            connections you can build a recovery cohort.
          </div>
        ) : (
          <>
            <div className="mt-4 text-sm font-medium">
              Members ({N})
            </div>
            <ul className="mt-2 space-y-2 max-h-64 overflow-auto">
              {candidates.map((c) => (
                <li key={c.pubkey}>
                  <label className="flex items-start gap-3 rounded-md border border-ink/15 bg-white px-3 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(c.pubkey)}
                      onChange={() => toggle(c.pubkey)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted font-mono">
                        {shortKey(c.pubkey)}
                      </div>
                    </div>
                  </label>
                </li>
              ))}
            </ul>

            <div className="mt-4">
              <label className="block text-sm">
                Threshold (M of N) — how many peers must cooperate
                <div className="mt-1 flex items-center gap-3">
                  <input
                    type="range"
                    min={2}
                    max={Math.max(2, N)}
                    value={thresholdClamped}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    disabled={N < 2}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-16 text-right">
                    {thresholdClamped} of {N}
                  </span>
                </div>
              </label>
              <p className="mt-1 text-xs text-muted">
                Lower M = easier to recover, easier to collude. Higher M =
                harder to recover, harder to collude. 3 of 5 is the
                operator-grade default; 4 of 7 is the spec-grade tier.
              </p>
            </div>

            <button
              type="button"
              onClick={publish}
              disabled={busy || N < 2}
              className="mt-4 w-full rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
            >
              {busy ? 'Publishing…' : 'Publish cohort'}
            </button>
            {initialView && (
              <button
                type="button"
                onClick={() => setDistributeOpen(true)}
                className="mt-2 w-full rounded-md border border-ink/15 py-2 text-sm font-medium hover:bg-ink/5"
              >
                Distribute shares to cohort…
              </button>
            )}
          </>
        )}
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
      {distributeOpen && (
        <DistributeSharesModal onClose={() => setDistributeOpen(false)} />
      )}
    </div>
  );
}
