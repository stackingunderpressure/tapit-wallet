import { lazy, Suspense } from 'react';
import type { Attestation, Wallet } from 'tapit-attest';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';

// The two identity-gate substrate sections shown on the Identity tab —
// the vouching circle (who could vouch for you) and the peer-protected
// gates (what those people protect). Grouped behind one wrapper +
// lazy-loaded together so HomeScreen stays under the 800-line hard limit
// and the gate substrate UI lives in one place as the item-11 ceremony
// arc grows (D1 request, D3 collect, etc. will land here).

const VouchingCircleSection = lazy(() =>
  import('../connections/VouchingCircleSection.tsx').then((m) => ({
    default: m.VouchingCircleSection,
  })),
);
const GatedLeafSection = lazy(() =>
  import('./GatedLeafSection.tsx').then((m) => ({
    default: m.GatedLeafSection,
  })),
);

interface Props {
  wallet: Wallet;
  ownerId: string;
  anchorWorker: WorkerHandle | null;
  holdings: readonly Attestation[];
  vouchingDraft: readonly string[];
  onVouchingDraftChange: (next: readonly string[]) => void;
  saveAndRefresh: () => Promise<void>;
}

export function IdentityGateSections({
  wallet,
  ownerId,
  anchorWorker,
  holdings,
  vouchingDraft,
  onVouchingDraftChange,
  saveAndRefresh,
}: Props) {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-ink/10 bg-paper/50 p-4 text-xs text-muted">
          Loading identity gates…
        </div>
      }
    >
      <VouchingCircleSection
        wallet={wallet}
        ownerId={ownerId}
        anchorWorker={anchorWorker}
        holdings={holdings}
        myKey={wallet.identity}
        draft={vouchingDraft}
        onDraftChange={onVouchingDraftChange}
        saveAndRefresh={saveAndRefresh}
      />
      <div className="mt-4">
        <GatedLeafSection
          wallet={wallet}
          ownerId={ownerId}
          anchorWorker={anchorWorker}
          holdings={holdings}
          saveAndRefresh={saveAndRefresh}
        />
      </div>
    </Suspense>
  );
}
