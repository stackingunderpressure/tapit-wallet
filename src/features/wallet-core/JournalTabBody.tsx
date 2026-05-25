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
// JournalComposer renders inline (carrying any prefill from a
// chat-promote moment); otherwise Classic shows the bottom action
// row (Sign someone else's entry / + New entry) and Fresh shows
// nothing here since FreshComposeFAB lives at the HomeScreen
// root. Extracted from HomeScreen to keep that file under the
// 800-line hard limit after sub-cut 2c added composer prefill state.
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
      <section className="mt-6 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
        <h2 className="text-base font-semibold">New entry</h2>
        <div className="mt-3">
          <JournalComposer
            onCreated={onCloseComposer}
            onCancel={onCloseComposer}
            prefill={composerPrefill ?? undefined}
          />
        </div>
      </section>
    );
  }
  if (resolvedTheme === 'fresh') return null;
  return (
    <div className="fixed bottom-20 inset-x-0 flex items-center justify-center gap-3 px-5 z-20">
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
