import { lazy, Suspense } from 'react';
import type { Attestation, Wallet } from 'tapit-attest';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';
import { useWallet } from './useWallet.ts';

// The identity-gate substrate sections — the vouching circle (who could
// vouch for you), the peer-protected gates (what those people protect), and
// the vouches you have given. Grouped behind one wrapper + lazy-loaded
// together so the gate substrate UI lives in one place as the item-11
// ceremony arc grows (D1 request, D3 collect, etc. will land here).
//
// MOUNT 2026-06-25: moved off the Identity tab into the Keychain tab
// (recovery/KeychainTab.tsx, "Vouching & gates" collapsible). The operator
// flagged Identity/Keychain content bleed-over; this is key/recovery/peer-
// protection work, so it belongs with the rest of the key dashboard, leaving
// Identity as purely "who you are." Still lives in wallet-core (recovery
// already depends_on wallet-core, so the cross-feature mount is clean).

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
const MyVouchesSection = lazy(() =>
  import('./MyVouchesSection.tsx').then((m) => ({
    default: m.MyVouchesSection,
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
  const { sendEnvelope } = useWallet();
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
      <MyVouchesSection
        wallet={wallet}
        ownerId={ownerId}
        anchorWorker={anchorWorker}
        holdings={holdings}
        sendEnvelope={sendEnvelope}
        saveAndRefresh={saveAndRefresh}
      />
    </Suspense>
  );
}
