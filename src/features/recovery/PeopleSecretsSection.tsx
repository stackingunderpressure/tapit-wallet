import { lazy, Suspense, useState } from 'react';

// "Your secrets" inside the People tab — the collapsible condo. List + Tree
// stay visible above; this sits as its own card that collapses down and
// expands when needed (operator, 2026-06-05: "list and tree visible always
// and secrets collapse down expand when needed"). It owns only the open/close
// state and lazy-loads the heavy dashboard chunk on first expand, so people
// who never open secrets pay nothing for it.
//
// Moved here from the Identity-tab launcher card: the operator wanted the
// whole secrets experience integrated where the connections and threads live,
// "not having to go somewhere else."

const SecretsDashboard = lazy(() =>
  import('./SecretsDashboard.tsx').then((m) => ({
    default: m.SecretsDashboard,
  })),
);

export function PeopleSecretsSection() {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-4 rounded-2xl border border-ink/10 bg-paper shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold">Your secrets</span>
          <span className="mt-0.5 block text-xs text-muted">
            Cards your circle holds for you — set them up, hand the pieces out,
            bring them back.
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
