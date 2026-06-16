import { lazy, Suspense, useState } from 'react';
import type { KinGraph, KinNode } from './kinGraph.ts';
import { FamilyTreeCanvas } from './FamilyTreeCanvas.tsx';
import { TreeViewToggle, type TreeView } from './TreeViewToggle.tsx';

// Family-tree — the canvas AREA: the "Tree | Explore" toggle plus the bordered
// frame that renders either the connected overview (FamilyTreeCanvas, default)
// or the focus-and-walk navigator (FamilyTreeExplorer). Extracted from
// FamilyTreeEditor to keep that file under the 800-line doctrine, and it is the
// natural home for the view-mode state + the explorer's lazy boundary.
//
// The explorer is React.lazy so it ships as its own FamilyTreeExplorer-*.js
// chunk and never inflates HomeScreen's eagerly-imported static graph; it only
// loads when the operator switches to Explore. Tree stays the default so
// nothing existing changes by default. The explorer reads the REAL graph (not
// the canvas's ancestor-slot-augmented graph) since its own "no one recorded
// above" affordance covers missing parents.
const FamilyTreeExplorer = lazy(() =>
  import('./FamilyTreeExplorer.tsx').then((m) => ({
    default: m.FamilyTreeExplorer,
  })),
);

interface Props {
  /** Real graph — passed to the explorer. */
  graph: KinGraph;
  /** Graph with dashed ancestor slots — passed to the canvas. */
  canvasGraph: KinGraph;
  selfId: string | null;
  onSelect: (node: KinNode, relationship: string) => void;
  onAddAncestor: (childId: string) => void;
}

export function TreeCanvasArea({
  graph,
  canvasGraph,
  selfId,
  onSelect,
  onAddAncestor,
}: Props) {
  const [treeView, setTreeView] = useState<TreeView>('tree');
  return (
    <>
      <TreeViewToggle value={treeView} onChange={setTreeView} />
      <div className="mt-2 rounded-xl border border-ink/10 bg-white p-2.5">
        {treeView === 'tree' ? (
          <FamilyTreeCanvas
            graph={canvasGraph}
            selfId={selfId}
            onSelect={onSelect}
            onAddAncestor={onAddAncestor}
          />
        ) : (
          <Suspense
            fallback={
              <p className="px-1 py-6 text-center text-sm text-muted">
                Loading explorer…
              </p>
            }
          >
            <FamilyTreeExplorer
              graph={graph}
              selfId={selfId}
              onSelect={onSelect}
            />
          </Suspense>
        )}
      </div>
    </>
  );
}
