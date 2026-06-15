import { describe, it, expect } from 'vitest';
import { mergeCandidates } from './mergeCandidates.ts';
import type { KinGraph, KinNode } from './kinGraph.ts';

const SHARED = 'c'.repeat(64); // the keyed relative we both connect through

function emptyGraph(): KinGraph {
  return {
    nodes: new Map(),
    parents: new Map(),
    children: new Map(),
    spouses: new Map(),
  };
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
function node(g: KinGraph, n: KinNode) {
  g.nodes.set(n.id, n);
}

// Build one side: a keyed shared person, their keyless parent "Pam", and
// the shared person is a child of Pam. ids are namespaced per side.
function side(prefix: string, pamBorn?: string): KinGraph {
  const g = emptyGraph();
  node(g, { id: `${prefix}-shared`, displayName: 'Shared', keyed: true, keyedPubkey: SHARED });
  node(g, { id: `${prefix}-pam`, displayName: 'Pam Winchester', keyed: false, born: pamBorn });
  parent(g, `${prefix}-pam`, `${prefix}-shared`);
  return g;
}

describe('mergeCandidates', () => {
  it('proposes a candidate when both sides have a same-named keyless relative of the shared person', () => {
    const mine = side('mine', '1949-01-01');
    const theirs = side('theirs', '1949-01-01');
    const candidates = mergeCandidates(mine, theirs, SHARED);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.mine.id).toBe('mine-pam');
    expect(candidates[0]?.theirs.id).toBe('theirs-pam');
  });

  it('proposes nothing when names differ', () => {
    const mine = side('mine');
    const theirs = side('theirs');
    // rename theirs
    theirs.nodes.get('theirs-pam')!.displayName = 'Patricia Jones';
    expect(mergeCandidates(mine, theirs, SHARED)).toHaveLength(0);
  });

  it('proposes nothing when birth dates conflict', () => {
    const mine = side('mine', '1949-01-01');
    const theirs = side('theirs', '1950-12-31');
    expect(mergeCandidates(mine, theirs, SHARED)).toHaveLength(0);
  });

  it('returns empty when the shared person is not in both trees', () => {
    const mine = side('mine');
    const theirs = emptyGraph();
    expect(mergeCandidates(mine, theirs, SHARED)).toHaveLength(0);
  });
});
