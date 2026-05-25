import { JournalComposer } from '../journal/JournalComposer.tsx';
import type { JournalPrefill } from '../messaging/promoteToJournalPrefill.ts';

interface Props {
  composerOpen: boolean;
  composerPrefill: JournalPrefill | null;
  resolvedTheme: 'classic' | 'fresh';
  onCompose: () => void;
  onWitness: () => void;
  onCloseComposer: () => void;
}

// Journal-tab compose surface. When composerOpen is true the
// JournalComposer renders as a full-screen page (fixed inset-0)
// with a back button at the top — operator: "When you click on
// new entry or witness it needs to be its own screen with back
// not hybrid with what's above." Otherwise Classic shows the
// bottom action row and Fresh shows nothing here since
// FreshComposeFAB lives at the HomeScreen root.
//
// The full-screen overlay uses bg-paper, which the Fresh CSS
// sweep flips to fresh-surface-raised on the dark body — so the
// page swap is theme-aware without per-theme JSX. z-40 sits
// above the sticky header and bottom nav (z-30) but below modals
// (z-50) like QrScanModal which can still open on top of it.
export function JournalTabBody({
  composerOpen,
  composerPrefill,
  resolvedTheme,
  onCompose,
  onWitness,
  onCloseComposer,
}: Props) {
  if (composerOpen) {
    return (
      <div className="fixed inset-0 z-40 bg-paper overflow-y-auto">
        <div className="max-w-md mx-auto p-5">
          <header className="flex items-center justify-between mb-5 -mx-5 px-5 py-2 sticky top-0 bg-paper/95 backdrop-blur z-10">
            <button
              type="button"
              onClick={onCloseComposer}
              className="text-sm text-muted hover:text-ink"
              aria-label="Back"
            >
              ← Back
            </button>
            <h2 className="text-base font-semibold">New entry</h2>
            <div className="w-12" aria-hidden />
          </header>
          <JournalComposer
            onCreated={onCloseComposer}
            onCancel={onCloseComposer}
            prefill={composerPrefill ?? undefined}
          />
        </div>
      </div>
    );
  }
  if (resolvedTheme === 'fresh') return null;
  return (
    <div className="fixed bottom-24 inset-x-0 flex items-center justify-center gap-3 px-5 z-20">
      <button
        type="button"
        onClick={onWitness}
        className="rounded-full bg-white text-ink border border-ink/15 px-4 py-3 text-sm font-medium shadow"
      >
        Sign someone else's entry
      </button>
      <button
        type="button"
        onClick={onCompose}
        className="rounded-full bg-ink text-paper px-5 py-3 font-medium shadow-lg"
      >
        + New entry
      </button>
    </div>
  );
}
