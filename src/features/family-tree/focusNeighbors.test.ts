import { describe, it, expect } from 'vitest';
import { focusNeighbors } from './focusNeighbors.ts';
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

// me + both parents + a spouse + two kids.
function family(): KinGraph {
  const g = emptyGraph();
  node(g, 'me', 'Me');
  node(g, 'mom', 'Mom');
  node(g, 'dad', 'Dad');
  node(g, 'spouse', 'Partner');
  node(g, 'kidB', 'Bea');
  node(g, 'kidA', 'Abe');
  parent(g, 'mom', 'me');
  parent(g, 'dad', 'me');
  spouse(g, 'me', 'spouse');
  parent(g, 'me', 'kidA');
  parent(g, 'me', 'kidB');
  return g;
}

describe('focusNeighbors', () => {
  it('returns parents up, spouse across, children down', () => {
    const n = focusNeighbors(family(), 'me');
    expect(n.parents.map((p) => p.node.id).sort()).toEqual(['dad', 'mom']);
    expect(n.spouses.map((p) => p.node.id)).toEqual(['spouse']);
    expect(n.children.map((p) => p.node.id)).toEqual(['kidA', 'kidB']);
  });

  it('orders neighbors deterministically by name (children fan in name order)', () => {
    const n = focusNeighbors(family(), 'me');
    // Abe before Bea regardless of insertion order.
    expect(n.children.map((c) => c.node.displayName)).toEqual(['Abe', 'Bea']);
  });

  it('names the relationship from the focused person, not from you', () => {
    // Focus on Mom: Me is her child, her parents are empty.
    const n = focusNeighbors(family(), 'mom');
    expect(n.children.map((c) => c.node.id)).toEqual(['me']);
    expect(n.children[0]?.relationToFocus).toBe('child');
    expect(n.parents).toEqual([]);
  });

  it('falls back to structural words when the graph cannot name it', () => {
    const g = emptyGraph();
    node(g, 'a', 'A');
    node(g, 'b', 'B');
    parent(g, 'a', 'b'); // a is parent of b, but no self-anchored label needed
    const fromB = focusNeighbors(g, 'b');
    expect(fromB.parents[0]?.relationToFocus).toBe('parent');
  });

  it('skips edges into nodes with no detail', () => {
    const g = emptyGraph();
    node(g, 'me', 'Me');
    parent(g, 'ghost', 'me'); // parent edge but no node for 'ghost'
    const n = focusNeighbors(g, 'me');
    expect(n.parents).toEqual([]);
  });

  it('returns empty lists for a missing focus node', () => {
    const n = focusNeighbors(family(), 'nope');
    expect(n.parents).toEqual([]);
    expect(n.spouses).toEqual([]);
    expect(n.children).toEqual([]);
  });
});
