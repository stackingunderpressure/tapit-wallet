import { lazy, Suspense, useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { findLatestCohort, readCohort } from '../recovery/createCohort.ts';

const CohortEditorModal = lazy(() =>
  import('../recovery/CohortEditorModal.tsx').then((m) => ({
    default: m.CohortEditorModal,
  })),
);

/**
 * RecoveryCohortSection — declare which peers from your handshakes would help
 * you recover this wallet on a new device. Any M of N of them together can put
 * you back; no single peer sees anything of yours on their own. Manages its
 * own (lazy) editor modal so the parent screen stays composition-only.
 */
export function RecoveryCohortSection({
  holdings,
  walletIdentity,
}: {
  holdings: Attestation[];
  walletIdentity: string;
}) {
  const [open, setOpen] = useState(false);
  const cohortAtt = findLatestCohort(holdings, walletIdentity);
  const cohortView = cohortAtt ? readCohort(cohortAtt) : null;
  const declared = !!cohortView && cohortView.members.length > 0;

  return (
    <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
      <div className="font-medium">Trusted helpers</div>
      {declared ? (
        <>
          <p className="mt-1 text-sm text-muted">
            {cohortView.threshold} of {cohortView.totalShares} peers declared to
            help if you ever need to recover this wallet on a new device. Use
            "Send each helper their piece" to actually hand out the encrypted
            shares — until you do, the cohort is declared but cannot yet bring
            you back.
          </p>
          <ul className="mt-3 space-y-1">
            {cohortView.members.map((m) => (
              <li key={m.pubkey} className="text-xs">
                <span className="font-medium">{m.name || '(no name)'}</span>{' '}
                <span className="text-muted font-mono">
                  {m.pubkey.slice(0, 8)}…{m.pubkey.slice(-4)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted">
          Declare which peers from your handshakes would help you recover this
          wallet on a new device. Pick at least two; any M of N of them together
          can put you back. Each individual peer sees nothing of yours on their
          own — only combined.
        </p>
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 rounded-md border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5"
      >
        {declared ? 'Edit helpers' : 'Declare helpers'}
      </button>

      {open && (
        <Suspense fallback={null}>
          <CohortEditorModal onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </section>
  );
}
