import { lazy, Suspense, useState } from 'react';
import { FamilyTreeEditor } from '../family-tree/FamilyTreeEditor.tsx';

// Friends' trees (consented share / receive / view). Lazy so the
// foreign-trees store, the bundle codec, and the read-only friend-tree
// surface only ship when the operator opens the Friends'-trees toggle or the
// share flow — keeps the HomeScreen chunk within bundle budget.
const FriendTreesView = lazy(() =>
  import('../friends-trees/FriendTreesView.tsx').then((m) => ({
    default: m.FriendTreesView,
  })),
);
const ShareTreeModal = lazy(() =>
  import('../friends-trees/ShareTreeModal.tsx').then((m) => ({
    default: m.ShareTreeModal,
  })),
);

// The Family tab body — extracted from HomeScreen so the screen stays under
// the 800-line hard limit when the friends-trees toggle + share entry point
// landed. Owns the "Your tree | Friends' trees" sub-view toggle, the
// "Share my tree" entry point (opens the consented ShareTreeModal), and the
// two lazy friends-trees surfaces. Your tree is the existing editable
// FamilyTreeEditor; Friends' trees is the read-only FriendTreesView.

const VIEWS = [
  { id: 'mine' as const, label: 'Your tree' },
  { id: 'friends' as const, label: "Friends' trees" },
];

export function FamilyTabBody() {
  // Family tab sub-view: the operator's own editable tree, or the read-only
  // trees friends have consented to share with them.
  const [familyView, setFamilyView] = useState<'mine' | 'friends'>('mine');
  // When open, the consented "Share my family tree" picker is shown.
  const [shareTreeOpen, setShareTreeOpen] = useState(false);

  return (
    <section className="mt-5">
      <div className="flex items-center justify-between gap-2">
        <div
          className="inline-flex rounded-lg border border-ink/10 bg-white p-0.5"
          role="tablist"
          aria-label="Family tree view"
        >
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={familyView === v.id}
              onClick={() => setFamilyView(v.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                familyView === v.id
                  ? 'bg-ink text-paper'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShareTreeOpen(true)}
          className="shrink-0 rounded-md border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink transition active:animate-fresh-press motion-reduce:active:animate-none hover:bg-ink/[0.04]"
        >
          Share my tree
        </button>
      </div>

      {familyView === 'mine' ? (
        <FamilyTreeEditor embedded />
      ) : (
        <Suspense
          fallback={
            <div className="mt-5 rounded-2xl border border-ink/10 bg-white px-4 py-6 text-center text-sm text-muted">
              Loading shared trees…
            </div>
          }
        >
          <FriendTreesView />
        </Suspense>
      )}

      {shareTreeOpen && (
        <Suspense fallback={null}>
          <ShareTreeModal onClose={() => setShareTreeOpen(false)} />
        </Suspense>
      )}
    </section>
  );
}
