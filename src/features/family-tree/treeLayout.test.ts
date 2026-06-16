import { describe, it, expect } from 'vitest';
import { layoutTree } from './treeLayout.ts';
import type { KinGraph } from './kinGraph.ts';

function emptyGraph(): KinGraph {
  return {
    nodes: new Map(),
    parents: new Map(),
    children: new Map(),
    spouses: new Map(),
  };
}
function node(g: KinGraph, id: string, displayName: string) {
  g.nodes.set(id, { id, displayName, keyed: false });
}
function add(map: Map<string, Set<string>>, k: string, v: string) {
  const s = map.get(k) ?? new Set<string>();
  s.add(v);
  map.set(k, s);
}
function parent(g: KinGraph, p: string, c: string) {
  add(g.parents, c, p);
  add(g.children, p, c);
}
function spouse(g: KinGraph, a: string, b: string) {
  add(g.spouses, a, b);
  add(g.spouses, b, a);
}

// me with both parents and all four grandparents.
function threeGen(): KinGraph {
  const g = emptyGraph();
  node(g, 'me', 'Me');
  node(g, 'mom', 'Mom');
  node(g, 'dad', 'Dad');
  node(g, 'mgm', 'Maternal Grandma');
  node(g, 'mgp', 'Maternal Grandpa');
  node(g, 'dgm', 'Paternal Grandma');
  node(g, 'dgp', 'Paternal Grandpa');
  parent(g, 'mom', 'me');
  parent(g, 'dad', 'me');
  parent(g, 'mgm', 'mom');
  parent(g, 'mgp', 'mom');
  parent(g, 'dgm', 'dad');
  parent(g, 'dgp', 'dad');
  return g;
}

describe('layoutTree', () => {
  it('places every node exactly once', () => {
    const g = threeGen();
    const layout = layoutTree(g, 'me');
    expect(layout.nodes).toHaveLength(g.nodes.size);
    expect(new Set(layout.nodes.map((n) => n.id)).size).toBe(g.nodes.size);
  });

  it('layers by generation: grandparents on top, you at the bottom', () => {
    const layout = layoutTree(threeGen(), 'me');
    const rowOf = (id: string) =>
      layout.nodes.find((n) => n.id === id)?.row;
    expect(layout.rowCount).toBe(3);
    expect(rowOf('mgm')).toBe(0);
    expect(rowOf('dgp')).toBe(0);
    expect(rowOf('mom')).toBe(1);
    expect(rowOf('dad')).toBe(1);
    expect(rowOf('me')).toBe(2);
    expect(layout.maxRowSize).toBe(4); // the grandparents row
  });

  it('groups each parent\'s parents together (barycenter, no interleave)', () => {
    const layout = layoutTree(threeGen(), 'me');
    const colOf = (id: string) =>
      layout.nodes.find((n) => n.id === id)?.col ?? -1;
    // Maternal pair adjacent; paternal pair adjacent.
    expect(Math.abs(colOf('mgm') - colOf('mgp'))).toBe(1);
    expect(Math.abs(colOf('dgm') - colOf('dgp'))).toBe(1);
  });

  it('emits every parent edge and is self-consistent', () => {
    const layout = layoutTree(threeGen(), 'me');
    const parentEdges = layout.edges.filter((e) => e.relation === 'parent');
    expect(parentEdges).toHaveLength(6);
    for (const e of parentEdges) {
      expect(layout.nodes.some((n) => n.id === e.fromId)).toBe(true);
      expect(layout.nodes.some((n) => n.id === e.toId)).toBe(true);
    }
  });

  it('dedupes spouse edges to one per pair', () => {
    const g = threeGen();
    node(g, 'spouse', 'My Spouse');
    spouse(g, 'me', 'spouse');
    const layout = layoutTree(g, 'me');
    expect(layout.edges.filter((e) => e.relation === 'spouse')).toHaveLength(1);
  });

  it('is deterministic', () => {
    const a = layoutTree(threeGen(), 'me');
    const b = layoutTree(threeGen(), 'me');
    expect(a).toEqual(b);
  });

  it('falls back to a single flat row when there is no self', () => {
    const layout = layoutTree(threeGen(), null);
    expect(layout.rowCount).toBe(1);
    expect(layout.nodes.every((n) => n.row === 0)).toBe(true);
    expect(layout.nodes.every((n) => n.relationship === 'relative')).toBe(true);
  });
});
