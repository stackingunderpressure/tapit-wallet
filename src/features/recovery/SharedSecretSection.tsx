import { lazy, Suspense, useState } from 'react';

// Launcher card for "Your secrets" — the self-contained, wallet-independent
// secret-splitting surface (v1, 2026-06-04). Lives on the Identity tab in
// the "your people" grouping because a jointly-held secret belongs alongside
// the vouching circle, even though it touches no wallet state. Owns its own
// open/close state and lazy-loads the modal so the split/combine + QR + the
// scenario templates only ship when the operator opens it.

const SharedSecretModal = lazy(() =>
  import('./SharedSecretModal.tsx').then((m) => ({
    default: m.SharedSecretModal,
  })),
);

export function SharedSecretSection() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 rounded-2xl border border-ink/10 bg-paper p-4">
      <h3 className="text-sm font-semibold">Your secrets</h3>
      <p className="mt-1 text-xs text-muted">
        Split a secret — a password, a safe word, a note — into pieces held by
        the people you trust. No single person can read it or change it; it
        takes a few of them together to bring it back. Everything happens on
        your device.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 rounded-md border border-ink/15 px-3 py-2 text-sm font-medium hover:bg-ink/5"
      >
        Set up a secret
      </button>
      {open && (
        <Suspense fallback={null}>
          <SharedSecretModal onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
