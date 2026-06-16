import { generationOf, type KinGraph, type KinNode } from './kinGraph.ts';

// Family-tree — the "missing known spots above you" engine (pure + tested).
//
// Operator, 2026-06-16: "missing known spots above you to fill in names."
// Every person has two biological parents, so for you and for each parent you
// have recorded, any parent slot that isn't filled yet is a KNOWN gap we can
// invite you to fill. This surfaces those gaps as synthetic placeholder nodes
// the canvas draws as dashed "+ add" ghosts in the row above, each wired to
// open the add-a-parent form already pointed at the right child.
//
// Scope is deliberately the direct ancestral spine up to grandparents (your
// generation and one above — generationOf 0 and 1): that is what "above you"
// means and it keeps the canvas from sprouting an unbounded fringe of empty
// slots. Deeper rungs fill in naturally as you add each generation, which then
// grows its own slots on the next render.

const PREFIX = '__slot__';

export interface AncestorSlot {
  /** Synthetic placeholder node id (never a real envelope id). */
  id: string;
  /** The real person this empty slot would be a parent of. */
  childId: string;
  /** That person's display name, for the add-form prompt. */
  childName: string;
}

function addTo(map: Map<string, Set<string>>, k: string, v: string) {
  let s = map.get(k);
  if (!s) {
    s = new Set();
    map.set(k, s);
  }
  s.add(v);
}

/**
 * The empty parent slots on your direct ancestral spine (you + your parents),
 * up to two parents each. Returns [] when there is no self node to anchor
 * "above you". Deterministic: stable order by child id then slot index.
 */
export function ancestorSlots(
  graph: KinGraph,
  selfId: string | null,
): AncestorSlot[] {
  if (!selfId || !graph.nodes.has(selfId)) return [];
  const slots: AncestorSlot[] = [];
  const ids = [...graph.nodes.keys()].sort();
  for (const id of ids) {
    const node = graph.nodes.get(id);
    if (!node || node.placeholderFor) continue;
    const gen = generationOf(graph, selfId, id);
    // You (gen 0) and your parents (gen 1) -> their parents are your parents
    // and grandparents. Skip descendants and anyone untraceable.
    if (gen === null || gen < 0 || gen > 1) continue;
    const have = graph.parents.get(id)?.size ?? 0;
    for (let n = have; n < 2; n++) {
      slots.push({
        id: `${PREFIX}:${id}:${n}`,
        childId: id,
        childName: node.displayName,
      });
    }
  }
  return slots;
}

/**
 * A clone of the graph with the missing ancestor slots injected as synthetic
 * placeholder parent nodes (+ their parent_of edges) so the layout engine
 * positions them in the row above their child. The original graph is never
 * mutated. When there is no self node the graph is returned untouched.
 */
export function withAncestorSlots(
  graph: KinGraph,
  selfId: string | null,
): KinGraph {
  const slots = ancestorSlots(graph, selfId);
  if (slots.length === 0) return graph;
  const nodes = new Map(graph.nodes);
  const parents = new Map(
    [...graph.parents].map(([k, v]) => [k, new Set(v)] as const),
  );
  const children = new Map(
    [...graph.children].map(([k, v]) => [k, new Set(v)] as const),
  );
  const spouses = new Map(
    [...graph.spouses].map(([k, v]) => [k, new Set(v)] as const),
  );
  for (const slot of slots) {
    const placeholder: KinNode = {
      id: slot.id,
      displayName: '',
      keyed: false,
      placeholderFor: slot.childId,
    };
    nodes.set(slot.id, placeholder);
    addTo(parents, slot.childId, slot.id);
    addTo(children, slot.id, slot.childId);
  }
  return { nodes, parents, children, spouses };
}
