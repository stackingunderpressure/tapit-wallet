import { describe, it, expect } from 'vitest';
import { groupByGeneration } from './treeGenerations.ts';
import type { KinGraph, KinNode } from './kinGraph.ts';

function emptyGraph(): KinGraph {
  return {
    nodes: new Map(),
    parents: new Map(),
    children: new Map(),
    spouses: new Map(),
  };
}
function node(id: string, name: string): KinNode {
  return { id, displayName: name, keyed: false };
}
function add(map: Map<string, Set<string>>, k: string, v: string) {
  let s = map.get(k);
  if (!s) {
    s = new Set();
    map.set(k, s);
  }
  s.add(v);
}
function parent(g: KinGraph, p: string, c: string) {
  add(g.parents, c, p);
  add(g.children, p, c);
}

describe('groupByGeneration', () => {
  it('orders generations oldest-first and places self in generation 0', () => {
    const g = emptyGraph();
    for (const [id, name] of [
      ['gp', 'Grandpa'],
      ['mom', 'Mom'],
      ['me', 'Me'],
      ['kid', 'Kid'],
    ] as const) {
      g.nodes.set(id, node(id, name));
    }
    parent(g, 'gp', 'mom');
    parent(g, 'mom', 'me');
    parent(g, 'me', 'kid');

    const groups = groupByGeneration(g, 'me');
    expect(groups.map((x) => x.generation)).toEqual([2, 1, 0, -1]);
    const self = groups.find((x) => x.generation === 0);
    expect(self?.members.some((m) => m.id === 'me' && m.relationship === 'you')).toBe(
      true,
    );
    const parents = groups.find((x) => x.generation === 1);
    expect(parents?.title).toBe('Parents, aunts & uncles');
    expect(parents?.members.map((m) => m.node.displayName)).toEqual(['Mom']);
  });

  it('puts untraceable nodes in an Other relatives group last', () => {
    const g = emptyGraph();
    g.nodes.set('me', node('me', 'Me'));
    g.nodes.set('mystery', node('mystery', 'Mystery'));
    const groups = groupByGeneration(g, 'me');
    const last = groups[groups.length - 1];
    expect(last?.generation).toBeNull();
    expect(last?.title).toBe('Other relatives');
    expect(last?.members.map((m) => m.id)).toEqual(['mystery']);
  });

  it('labels everyone relative when there is no self node', () => {
    const g = emptyGraph();
    g.nodes.set('a', node('a', 'A'));
    const groups = groupByGeneration(g, null);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.generation).toBeNull();
    expect(groups[0]?.members[0]?.relationship).toBe('relative');
  });
});
