import type { MinimalTreeProjection } from './familyTreeProjection.ts';

// Friends' trees — a tiny pure helper for the SHARE PREVIEW.
//
// The minimal-share preview tells the operator exactly how much shape is
// leaving the wallet: "{N} people, {G} generations, first names only". This
// computes G — the number of distinct generation LEVELS the parent_of edges
// span — from the redacted projection alone (no names, no dates needed). It
// is intentionally a structure-only count so the preview itself reveals
// nothing sensitive: it is computed from the very payload that ships.

/**
 * How many generation levels the projection's parent_of structure spans.
 * A flat set of people with no parent edges is 1 generation; each parent
 * layer adds one. Cycle-safe (defensive — a malformed projection can't hang
 * the preview). Returns 1 for an empty/edgeless projection so the copy reads
 * naturally ("1 generation").
 */
export function generationSpan(projection: MinimalTreeProjection): number {
  const ids = new Set(projection.nodes.map((n) => n.id));
  if (ids.size === 0) return 0;

  // child -> parents, restricted to nodes that exist in the projection.
  const parents = new Map<string, Set<string>>();
  for (const e of projection.edges) {
    if (e.relation !== 'parent_of') continue;
    if (!ids.has(e.from) || !ids.has(e.to)) continue;
    let set = parents.get(e.to);
    if (!set) {
      set = new Set();
      parents.set(e.to, set);
    }
    set.add(e.from);
  }
  if (parents.size === 0) return 1;

  // Longest chain of parent links (number of nodes on the deepest line),
  // memoized with cycle guarding.
  const depthCache = new Map<string, number>();
  const visiting = new Set<string>();

  function depth(id: string): number {
    const cached = depthCache.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 1; // cycle — stop counting this branch
    visiting.add(id);
    let best = 1;
    for (const p of parents.get(id) ?? []) {
      best = Math.max(best, 1 + depth(p));
    }
    visiting.delete(id);
    depthCache.set(id, best);
    return best;
  }

  let span = 1;
  for (const id of ids) span = Math.max(span, depth(id));
  return span;
}
