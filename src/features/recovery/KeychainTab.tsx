import { lazy, Suspense, useState } from 'react';
import { PeopleSecretsSection } from './PeopleSecretsSection.tsx';

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

export function KeychainTab() {
  const [recoveryOpen, setRecoveryOpen] = useState(true);
  // Liveness starts collapsed — the dashboard already opens with secrets +
  // social recovery expanded, and this is the newest section, so it stays
  // tucked until the operator reaches for it.
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
            up recovery, and see where your pieces live.
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
