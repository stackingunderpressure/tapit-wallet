import { useEffect, useMemo, useState } from 'react';
import {
  relationshipLabel,
  type KinGraph,
  type KinNode,
} from './kinGraph.ts';
import { genderKinLabel } from './gender.ts';
import { explainRelationship } from './kinEducation.ts';
import { focusNeighbors, type FocusNeighbor } from './focusNeighbors.ts';
import { KinAvatar } from './KinAvatar.tsx';

// Family-tree EXPLORER — the focus-and-walk navigator (operator: "almost
// feel like you could speed run up and down the thing... the more you scroll
// up you go up the tree and then when you scroll down it gets wider and
// bigger you can go down different legs").
//
// A drop-in alternate view to FamilyTreeCanvas (same Props), but instead of
// the whole connected diagram it RE-ROOTS on one person and shows only their
// immediate neighbors: parents in a tight centered band ABOVE (the line
// converges as you climb toward the apex), the focused person big in the
// CENTER with their spouse beside them, and their children fanned WIDER as a
// horizontally-scrollable row BELOW (each child is a different leg down). Tap
// a parent to ascend, tap a child to descend that leg, tap the center person
// to open their full detail (the existing PersonDetailView via onSelect).
// All navigation is local re-rooting — no graph math here, no data writes;
// the walk logic lives in the pure focusNeighbors helper.

interface Props {
  graph: KinGraph;
  selfId: string | null;
  onSelect: (node: KinNode, relationship: string) => void;
}

// The neutral relationship of `id` as seen from you, gendered into the
// family's own word ("mother", "1st cousin", …). "you" for self, "a relative"
// when the graph cannot trace a tie (a focus reached via a leg that loops
// outside your line).
function relationToYou(
  graph: KinGraph,
  selfId: string | null,
  node: KinNode,
): string {
  if (selfId && node.id === selfId) return 'you';
  const neutral = selfId ? relationshipLabel(graph, selfId, node.id) : null;
  if (!neutral) return 'a relative';
  return genderKinLabel(neutral, node.sex);
}

export function FamilyTreeExplorer({ graph, selfId, onSelect }: Props) {
  // Default the focus to you, or the first node when there is no self-node.
  const firstId = useMemo(
    () => selfId ?? [...graph.nodes.keys()][0] ?? null,
    [graph, selfId],
  );
  const [focusedId, setFocusedId] = useState<string | null>(firstId);

  // If the focused node disappears from the graph (e.g. removed mid-session)
  // or the graph swaps under us, fall back to a valid root.
  useEffect(() => {
    if (focusedId && graph.nodes.has(focusedId)) return;
    setFocusedId(firstId);
  }, [graph, focusedId, firstId]);

  const focusedNode = focusedId ? graph.nodes.get(focusedId) ?? null : null;

  const neighbors = useMemo(
    () => (focusedId ? focusNeighbors(graph, focusedId) : null),
    [graph, focusedId],
  );

  if (!focusedNode || !neighbors) {
    return (
      <p className="px-1 py-6 text-center text-sm text-muted">
        No one to explore yet. Add a relative in Tree view to start walking
        your line.
      </p>
    );
  }

  const youLabel = relationToYou(graph, selfId, focusedNode);
  const spouse = neighbors.spouses[0] ?? null;
  const hasParents = neighbors.parents.length > 0;
  const hasChildren = neighbors.children.length > 0;
  const isAtSelf = Boolean(selfId && focusedNode.id === selfId);

  // A small tappable relative card used in the parent band and the child row.
  function relativeCard(n: FocusNeighbor, accent: boolean) {
    return (
      <button
        key={n.node.id}
        type="button"
        onClick={() => setFocusedId(n.node.id)}
        className={`flex w-24 shrink-0 flex-col items-center rounded-xl border bg-white px-1.5 py-2 text-center transition active:animate-fresh-press motion-reduce:active:animate-none hover:bg-ink/[0.03] ${
          accent ? 'border-accent/40' : 'border-ink/15'
        }`}
      >
        <KinAvatar node={n.node} size={34} />
        <span className="mt-1 w-full truncate text-[12px] font-medium leading-tight">
          {n.node.displayName}
        </span>
        <span className="w-full truncate text-[10px] text-muted">
          {genderKinLabel(n.relationToFocus, n.node.sex)}
        </span>
      </button>
    );
  }

  return (
    <div className="animate-fresh-rise motion-reduce:animate-none">
      {/* Breadcrumb — who you are viewing, plus a one-tap reset to you. */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="truncate text-xs text-muted">
          Viewing{' '}
          <span className="font-semibold text-ink">
            {focusedNode.displayName}
          </span>{' '}
          ({youLabel})
        </p>
        {selfId && !isAtSelf && (
          <button
            type="button"
            onClick={() => setFocusedId(selfId)}
            className="shrink-0 rounded-md border border-ink/15 px-2 py-1 text-[11px] text-ink transition active:animate-fresh-press motion-reduce:active:animate-none hover:bg-ink/[0.04]"
          >
            Back to you
          </button>
        )}
      </div>

      {/* UPPER band — parents, tight + centered (the line converges as you
          climb). An explicit "to parents" control sits above for discovery;
          tapping a parent card is the primary gesture. */}
      <div className="flex flex-col items-center">
        <span className="mb-1 text-[11px] text-muted" aria-hidden>
          {hasParents ? '▲ tap to go up' : ''}
        </span>
        {hasParents ? (
          <div className="flex justify-center gap-2">
            {neighbors.parents.map((p) => relativeCard(p, false))}
          </div>
        ) : (
          <p className="mb-1 text-center text-[11px] text-muted">
            No one recorded above — add them in Tree view.
          </p>
        )}
        {/* Connector hint from parents down to the focused person. */}
        <div className="my-1 h-4 w-px bg-ink/15" aria-hidden />
      </div>

      {/* CENTER — the focused person, prominent, spouse beside them. */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => onSelect(focusedNode, youLabel)}
          className={`flex max-w-[12rem] flex-col items-center rounded-2xl border-2 bg-white px-4 py-3 text-center transition active:animate-fresh-press motion-reduce:active:animate-none hover:bg-ink/[0.03] ${
            isAtSelf ? 'border-accent ring-2 ring-accent/40' : 'border-accent/60'
          }`}
        >
          <KinAvatar node={focusedNode} size={56} />
          <span className="mt-1.5 w-full truncate text-sm font-semibold leading-tight">
            {focusedNode.displayName}
          </span>
          <span className="w-full truncate text-xs text-accent">{youLabel}</span>
          <span className="mt-1 text-[10px] text-muted">tap for details</span>
        </button>
        {spouse && (
          <button
            type="button"
            onClick={() => setFocusedId(spouse.node.id)}
            className="flex w-24 shrink-0 flex-col items-center rounded-xl border border-dashed border-ink/25 bg-white px-1.5 py-2 text-center transition active:animate-fresh-press motion-reduce:active:animate-none hover:bg-ink/[0.03]"
          >
            <KinAvatar node={spouse.node} size={34} />
            <span className="mt-1 w-full truncate text-[12px] font-medium leading-tight">
              {spouse.node.displayName}
            </span>
            <span className="w-full truncate text-[10px] text-muted">
              {genderKinLabel(spouse.relationToFocus, spouse.node.sex)}
            </span>
          </button>
        )}
      </div>

      {/* One-line plain-English kinship explanation for the focused person. */}
      <p className="mx-auto mt-2 max-w-xs text-center text-[11px] leading-snug text-muted">
        📖 {explainRelationship(relationshipLabel(graph, selfId ?? '', focusedNode.id) ?? youLabel)}
      </p>

      {/* LOWER band — children fanned WIDER as a horizontal scroll (the legs
          down). Each child re-roots the explorer onto that leg. */}
      <div className="mt-3 flex flex-col items-center">
        <div className="mb-1 h-4 w-px bg-ink/15" aria-hidden />
        <span className="mb-1 text-[11px] text-muted" aria-hidden>
          {hasChildren ? '▼ tap to go down a leg' : ''}
        </span>
        {hasChildren && (
          <div className="flex w-full gap-2 overflow-x-auto pb-1">
            {neighbors.children.map((c) => relativeCard(c, true))}
          </div>
        )}
      </div>

      {/* Explicit up/down affordances for discoverability — the cards above
          are the primary gesture, these name the directions in words. */}
      <div className="mt-3 flex justify-center gap-2">
        <button
          type="button"
          disabled={!hasParents}
          onClick={() => {
            const up = neighbors.parents[0];
            if (up) setFocusedId(up.node.id);
          }}
          className="rounded-md border border-ink/15 px-3 py-1.5 text-xs text-ink transition active:animate-fresh-press motion-reduce:active:animate-none hover:bg-ink/[0.04] disabled:opacity-40"
        >
          ▲ to parents
        </button>
        <button
          type="button"
          disabled={!hasChildren}
          onClick={() => {
            const down = neighbors.children[0];
            if (down) setFocusedId(down.node.id);
          }}
          className="rounded-md border border-ink/15 px-3 py-1.5 text-xs text-ink transition active:animate-fresh-press motion-reduce:active:animate-none hover:bg-ink/[0.04] disabled:opacity-40"
        >
          ▼ to children
        </button>
      </div>
    </div>
  );
}
