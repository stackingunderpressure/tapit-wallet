import type { ReactNode } from 'react';

// A centered pop-up over the whole screen (not a bottom-of-page section)
// for the game's confirmations — matches the app's other modals
// (fixed backdrop + centered card). Tapping the backdrop dismisses via
// onDismiss; pass undefined to disable dismiss while busy.
export function ArenaModal({
  onDismiss,
  children,
}: {
  onDismiss?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onDismiss}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-accent/40 bg-white p-5 shadow-xl"
      >
        {children}
      </div>
    </div>
  );
}
