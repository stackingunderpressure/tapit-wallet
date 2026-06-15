import {
  generationOf,
  relationshipLabel,
  type KinGraph,
  type KinNode,
} from './kinGraph.ts';

// Family-tree CUT 1 (render slice) — group the graph into GENERATION
// ROWS relative to you, oldest at the top, so the tree reads as a shape
// instead of a flat list. Pure: given the graph + your node id, bucket
// every node by its generation (parents above, you in the middle,
// children below) with a friendly section title and each member's
// derived relationship label. Anything that can't be placed on a
// generation lands in an "Other relatives" group so nothing is hidden.

export interface GenerationMember {
  id: string;
  node: KinNode;
  /** Derived relationship to you ("you", "parent", "1st cousin", …). */
  relationship: string;
}

export interface GenerationGroup {
  /** +older / 0 you / -younger; null = untraceable ("Other relatives"). */
  generation: number | null;
  title: string;
  members: GenerationMember[];
}

function titleFor(generation: number): string {
  switch (generation) {
    case 0:
      return 'You, siblings, cousins & partners';
    case 1:
      return 'Parents, aunts & uncles';
    case -1:
      return 'Children, nieces & nephews';
    case 2:
      return 'Grandparents';
    case -2:
      return 'Grandchildren';
    default:
      if (generation > 2) {
        return `${'Great-'.repeat(generation - 2)}grandparents' generation`;
      }
      return `${'Great-'.repeat(-generation - 2)}grandchildren's generation`;
  }
}

/**
 * Group every node in the graph into generation rows relative to
 * `selfId`. Groups are ordered oldest-first (highest generation at the
 * top), the untraceable group last. Members within a group are sorted by
 * name. `self` is included in generation 0.
 */
export function groupByGeneration(
  graph: KinGraph,
  selfId: string | null,
): GenerationGroup[] {
  const byGen = new Map<number | null, GenerationMember[]>();
  for (const node of graph.nodes.values()) {
    const generation = selfId ? generationOf(graph, selfId, node.id) : null;
    const relationship =
      node.id === selfId
        ? 'you'
        : selfId
          ? relationshipLabel(graph, selfId, node.id) ?? 'relative'
          : 'relative';
    const key = generation;
    const list = byGen.get(key) ?? [];
    list.push({ id: node.id, node, relationship });
    byGen.set(key, list);
  }

  const groups: GenerationGroup[] = [];
  const numericKeys = [...byGen.keys()].filter(
    (k): k is number => k !== null,
  );
  numericKeys.sort((a, b) => b - a); // oldest (highest +) first
  for (const gen of numericKeys) {
    const members = (byGen.get(gen) as GenerationMember[]).sort((a, b) =>
      a.node.displayName.localeCompare(b.node.displayName),
    );
    groups.push({ generation: gen, title: titleFor(gen), members });
  }
  if (byGen.has(null)) {
    const members = (byGen.get(null) as GenerationMember[]).sort((a, b) =>
      a.node.displayName.localeCompare(b.node.displayName),
    );
    groups.push({ generation: null, title: 'Other relatives', members });
  }
  return groups;
}
