import { useMemo } from 'react';
import { useWallet } from '../wallet-core/useWallet.ts';
import { buildLatticeView, type PeerNode } from './lattice.ts';

// Phase 5e-iv — lattice visualization. Read-only render of the
// operator's network in one place: handshakes (Tier P + Tier R),
// organizations they're a member of, and the declared recovery
// cohort with M-of-N. The hyphal lattice §10 of
// MYCELIUM_NETWORK_SPEC.md, surfaced.
//
// Editing happens through the already-shipped flows — the
// handshake modal on People, the membership modal under Identity,
// the cohort editor under Settings. This panel just shows what's
// already there, so the operator can see their woven web in one
// glance instead of one tab at a time.

function shortKey(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
}

function PeerRow({ peer }: { peer: PeerNode }) {
  return (
    <li className="rounded-md border border-ink/15 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{peer.name}</div>
          <div className="text-xs text-muted font-mono">{shortKey(peer.pubkey)}</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {peer.inPerson && (
            <span className="rounded-full bg-emerald-100 text-emerald-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              In&nbsp;person
            </span>
          )}
          {peer.remote && (
            <span className="rounded-full bg-sky-100 text-sky-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              Remote
            </span>
          )}
          {peer.inCohort && (
            <span
              className="rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              title="Named in your recovery cohort"
            >
              Cohort
            </span>
          )}
        </div>
      </div>
      {peer.firstSeen && (
        <div className="mt-1 text-[11px] text-muted">First connected {formatDate(peer.firstSeen)}</div>
      )}
    </li>
  );
}

export function LatticePanel() {
  const { wallet, holdings } = useWallet();
  const view = useMemo(
    () => buildLatticeView(holdings, wallet.identity),
    [holdings, wallet.identity],
  );

  const empty =
    view.peers.length === 0 &&
    view.organizations.length === 0 &&
    !view.cohort.declared;

  if (empty) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/15 bg-white/60 px-5 py-10 text-center">
        <div className="text-xs uppercase tracking-wide text-accent">
          Lattice is empty
        </div>
        <h2 className="mt-2 text-base font-semibold">Your network in one place</h2>
        <p className="mt-2 text-sm text-muted">
          As you meet people, join organizations, and declare a recovery cohort,
          they all gather here — the woven web your verifiable life sits on.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="rounded-2xl border border-ink/10 bg-white px-4 py-3">
        <div className="text-xs uppercase tracking-wide text-muted">Your lattice</div>
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-lg font-semibold">{view.totals.tierPCount}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted">In&nbsp;person</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{view.totals.tierRCount}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted">Remote</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{view.totals.orgsCount}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted">Orgs</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{view.totals.cohortCount}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted">Cohort</div>
          </div>
        </div>
      </div>

      {/* Recovery cohort */}
      {view.cohort.declared ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wide text-amber-900">Recovery cohort</div>
            <div className="text-xs font-semibold text-amber-900">
              {view.cohort.threshold} of {view.cohort.totalShares}
            </div>
          </div>
          <p className="mt-1 text-sm">
            Any {view.cohort.threshold} of these {view.cohort.totalShares} peers can help you
            recover this wallet on a new device.
          </p>
          {view.cohort.declaredAt && (
            <div className="mt-1 text-[11px] text-muted">
              Declared {formatDate(view.cohort.declaredAt)}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-ink/15 bg-white/60 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-muted">Recovery cohort</div>
          <p className="mt-1 text-sm text-muted">
            Not declared yet. Under Settings, name the peers who could help you
            recover this wallet on a new device.
          </p>
        </div>
      )}

      {/* Peers */}
      {view.peers.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-muted mb-2">
            People ({view.peers.length})
          </div>
          <ul className="space-y-2">
            {view.peers.map((p) => (
              <PeerRow key={p.pubkey} peer={p} />
            ))}
          </ul>
        </div>
      )}

      {/* Organizations */}
      {view.organizations.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-muted mb-2">
            Organizations ({view.organizations.length})
          </div>
          <ul className="space-y-2">
            {view.organizations.map((o) => (
              <li
                key={o.orgId}
                className="rounded-md border border-ink/15 bg-white px-3 py-2"
              >
                <div className="text-sm font-medium truncate">{o.orgName}</div>
                <div className="text-xs text-muted font-mono">{shortKey(o.orgId)}</div>
                {o.issuedAt && (
                  <div className="mt-1 text-[11px] text-muted">
                    Member since {formatDate(o.issuedAt)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
