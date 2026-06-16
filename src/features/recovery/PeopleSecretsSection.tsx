import { lazy, Suspense, useState } from 'react';

// "Your secrets" — a real, purpose-built MODULE (now the secrets section of the
// Keychain key-dashboard tab; moved out of the People tab 2026-06-16 so all
// key tasks live in one place), not a collapsible paragraph (operator: "make
// it like a secret module,
// a thing that looks like that's what it's made to do, not a little block of
// text you click on... see who you sent your secrets to right off the bat and
// bring them back in one click"). It presents as its own surface with an icon
// tile and a clear purpose line, opens straight to your secret cards (who holds
// each piece + one-tap bring-back live on each card), and stays collapsible so
// it never dominates the tab. The heavy dashboard chunk still lazy-loads, but
// it loads open by default now so the module reads as something that does
// something for you.
//
// This is the single home for YOUR secrets. Wallet recovery (the cohort that
// can restore this wallet on a new device) is its own special flow in Settings
// and on the locked-out screen, deliberately kept distinct so it can't be
// confused with a casual secret.

const SecretsDashboard = lazy(() =>
  import('./SecretsDashboard.tsx').then((m) => ({
    default: m.SecretsDashboard,
  })),
);

export function PeopleSecretsSection() {
  const [open, setOpen] = useState(true);
  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-ink/10 bg-paper shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-xl"
        >
          🔐
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Your secrets</span>
          <span className="mt-0.5 block text-xs text-muted">
            Split a secret across people you trust. See who holds each piece and
            bring it back in one tap.
          </span>
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        >
          <path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-ink/10 px-4 pb-4">
          <Suspense
            fallback={
              <div className="mt-3 text-xs text-muted">Opening your secrets…</div>
            }
          >
            <SecretsDashboard />
          </Suspense>
        </div>
      )}
    </section>
  );
}
