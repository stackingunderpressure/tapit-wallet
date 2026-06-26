import { lazy, Suspense, useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { FamilyTreeEditor } from '../family-tree/FamilyTreeEditor.tsx';
import { FamilyIdentitySections } from './FamilyIdentitySections.tsx';

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

// The Family tab body — the one home for everything family, so family is
// never spread across two tabs again (operator directive 2026-06-26: "we
// have family in two different spots, combine into one super family tab").
// It owns the "Your tree | Household | Friends' trees" sub-view toggle, the
// "Share my tree" entry point (opens the consented ShareTreeModal), and the
// lazy friends-trees surfaces. The three sub-views are the two distinct
// family models plus sharing: "Your tree" is the editable genealogy
// (FamilyTreeEditor — lineage, derived relationships, keyless ancestors);
// "Household" is the co-signed family-unit declaration (FamilyIdentitySections
// — named household, roles, N-of-M ratification) that used to live on the
// Identity tab and was moved here; "Friends' trees" is the read-only
// FriendTreesView. The household data + its Start/Edit modal triggers are
// owned by HomeScreen (where the StartFamilyModal mounts already live) and
// threaded in as props, so relocating the section did not move the modal
// plumbing and carried no signed-format risk.

const VIEWS = [
  { id: 'mine' as const, label: 'Your tree' },
  { id: 'household' as const, label: 'Household' },
  { id: 'friends' as const, label: "Friends' trees" },
];

interface Props {
  /** The co-signed family units the operator belongs to — computed in
   *  HomeScreen and threaded down so the Household sub-view can render the
   *  relocated FamilyIdentitySections. */
  familyUnits: readonly Attestation[];
  /** Pubkey → display-name lookup for member chips. */
  namesByPubkey: ReadonlyMap<string, string>;
  /** Opens StartFamilyModal (create) — mounted in HomeScreen. */
  onStartFamily: () => void;
  /** Opens StartFamilyModal in edit mode for a founded, solely-signed unit. */
  onEditFamily: (att: Attestation) => void;
}

export function FamilyTabBody({
  familyUnits,
  namesByPubkey,
  onStartFamily,
  onEditFamily,
}: Props) {
  // Family tab sub-view: the operator's own editable tree, the co-signed
  // household declaration, or the read-only trees friends have shared.
  const [familyView, setFamilyView] = useState<'mine' | 'household' | 'friends'>(
    'mine',
  );
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
        {/* "Share my tree" shares the genealogy tree, so it only belongs on
            the tree-facing views — showing it over the Household (family-unit)
            sub-view would cross two different family models and is exactly the
            confusing angle the one-tab consolidation is meant to remove. */}
        {familyView !== 'household' && (
          <button
            type="button"
            onClick={() => setShareTreeOpen(true)}
            className="shrink-0 rounded-md border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink transition active:animate-fresh-press motion-reduce:active:animate-none hover:bg-ink/[0.04]"
          >
            Share my tree
          </button>
        )}
      </div>

      {familyView === 'mine' && <FamilyTreeEditor embedded />}

      {familyView === 'household' && (
        <FamilyIdentitySections
          familyUnits={familyUnits}
          namesByPubkey={namesByPubkey}
          onStartFamily={onStartFamily}
          onEditFamily={onEditFamily}
        />
      )}

      {familyView === 'friends' && (
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
