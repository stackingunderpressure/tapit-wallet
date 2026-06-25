import { lazy, Suspense, useState } from 'react';
import { PeopleSecretsSection } from './PeopleSecretsSection.tsx';
import { useWallet } from '../wallet-core/useWallet.ts';

// Keychain — the dashboard for your key (operator, 2026-06-16: "a tab by itself,
// a dashboard for your key that does other stuff... social recovery, the
// DynastyTrust, the secrets, anything to do with extra stuff you can do with
// your key, all in one spot, 100% usable and collapsible"). This evolves the
// old read-only Lattice tab into the single home for advanced key tasks, so
// there is ONE place for them rather than the same capability scattered across
// People, Settings, and the locked-out screen.
//
// Phase 1 (this cut): your secrets (moved here out of the People tab) + social
// recovery (the lattice of who can restore this wallet). Phase 2 pulls the
// cohort editor / distribute / recovery ceremony in as first-class actionable
// sections; Phase 3 brings DynastyTrust multisig in over the inter-app signing
// pathway (it lives in the dynastytrust repo). See the key-dashboard idea entry.

const LatticePanel = lazy(() =>
  import('./LatticePanel.tsx').then((m) => ({ default: m.LatticePanel })),
);

const LivenessPanel = lazy(() =>
  import('../liveness/LivenessPanel.tsx').then((m) => ({
    default: m.LivenessPanel,
  })),
);

// The vouching circle + peer-protected gates + vouches you have given.
// Moved here out of the Identity tab (2026-06-25, operator: "the identity
// tab and key tab have bleed over ... make sure everything is in the right
// tab"). The Identity tab is now purely who you ARE; everything you DO with
// your key and your trusted circle lives here, matching the dashboard's
// stated charter ("anything to do with extra stuff you can do with your key,
// all in one spot").
const IdentityGateSections = lazy(() =>
  import('../wallet-core/IdentityGateSections.tsx').then((m) => ({
    default: m.IdentityGateSections,
  })),
);

export function KeychainTab() {
  const { wallet, ownerId, anchorWorker, holdings, prefs, updatePrefs, save, refresh } =
    useWallet();
  const [recoveryOpen, setRecoveryOpen] = useState(true);
  // Vouching + liveness start collapsed — the dashboard opens with secrets +
  // social recovery expanded, and these heavier sections stay tucked until the
  // operator reaches for them.
  const [vouchingOpen, setVouchingOpen] = useState(false);
  const [livenessOpen, setLivenessOpen] = useState(false);
  return (
    <section className="mt-5 space-y-4">
      <header className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent/10 text-2xl"
        >
          🔑
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Your key</h2>
          <p className="text-xs text-muted">
            Everything you can do with your key in one place — split secrets, set
            up recovery, choose who vouches for you, and check in with your
            circle.
          </p>
        </div>
      </header>

      <PeopleSecretsSection />

      <section className="overflow-hidden rounded-2xl border border-ink/10 bg-paper shadow-sm">
        <button
          type="button"
          aria-expanded={recoveryOpen}
          onClick={() => setRecoveryOpen((o) => !o)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
        >
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-xl"
          >
            🛟
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Social recovery</span>
            <span className="mt-0.5 block text-xs text-muted">
              Who can help restore this wallet, and how your circle is verified.
            </span>
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className={`h-4 w-4 shrink-0 text-muted transition-transform ${recoveryOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <path
              d="M5 7.5l5 5 5-5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {recoveryOpen && (
          <div className="border-t border-ink/10 px-4 pb-4">
            <Suspense
              fallback={
                <div className="mt-3 text-xs text-muted">
                  Loading your circle…
                </div>
              }
            >
              <LatticePanel />
            </Suspense>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-ink/10 bg-paper shadow-sm">
        <button
          type="button"
          aria-expanded={vouchingOpen}
          onClick={() => setVouchingOpen((o) => !o)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
        >
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-xl"
          >
            🤝
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Vouching &amp; gates</span>
            <span className="mt-0.5 block text-xs text-muted">
              Who can vouch for who you are, and the things those people help
              you unlock.
            </span>
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className={`h-4 w-4 shrink-0 text-muted transition-transform ${vouchingOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <path
              d="M5 7.5l5 5 5-5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {vouchingOpen && (
          <div className="border-t border-ink/10 px-4 pb-4 pt-4">
            <Suspense
              fallback={
                <div className="text-xs text-muted">Loading vouching…</div>
              }
            >
              <IdentityGateSections
                wallet={wallet}
                ownerId={ownerId}
                anchorWorker={anchorWorker}
                holdings={holdings}
                vouchingDraft={prefs.vouchingCirclePubkeys}
                onVouchingDraftChange={(next) =>
                  void updatePrefs({ vouchingCirclePubkeys: [...next] })
                }
                saveAndRefresh={async () => {
                  await save();
                  await refresh();
                }}
              />
            </Suspense>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-ink/10 bg-paper shadow-sm">
        <button
          type="button"
          aria-expanded={livenessOpen}
          onClick={() => setLivenessOpen((o) => !o)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
        >
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-xl"
          >
            💚
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              Liveness / circle check-in
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              Tell the people you trust you are OK, and see at a glance whether
              they are.
            </span>
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className={`h-4 w-4 shrink-0 text-muted transition-transform ${livenessOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <path
              d="M5 7.5l5 5 5-5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {livenessOpen && (
          <div className="border-t border-ink/10 px-4 pb-4 pt-4">
            <Suspense
              fallback={
                <div className="text-xs text-muted">Loading check-in…</div>
              }
            >
              <LivenessPanel />
            </Suspense>
          </div>
        )}
      </section>
    </section>
  );
}
