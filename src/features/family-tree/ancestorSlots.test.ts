import { describe, it, expect } from 'vitest';
import type { KinGraph, KinNode } from './kinGraph.ts';
import { ancestorSlots, withAncestorSlots } from './ancestorSlots.ts';

// Build a small graph by hand (the layout/canvas path uses hand-built graphs
// too). parents: childId -> set(parentIds); children mirrors it.
function graphOf(
  nodes: KinNode[],
  parentEdges: [parent: string, child: string][],
): KinGraph {
  const g: KinGraph = {
    nodes: new Map(nodes.map((n) => [n.id, n])),
    parents: new Map(),
    children: new Map(),
    spouses: new Map(),
  };
  const add = (m: Map<string, Set<string>>, k: string, v: string) => {
    const s = m.get(k) ?? new Set<string>();
    s.add(v);
    m.set(k, s);
  };
  for (const [p, c] of parentEdges) {
    add(g.parents, c, p);
    add(g.children, p, c);
  }
  return g;
}

const me: KinNode = { id: 'me', displayName: 'Me', keyed: true };
const mom: KinNode = { id: 'mom', displayName: 'Mom', keyed: false };
const dad: KinNode = { id: 'dad', displayName: 'Dad', keyed: false };
const kid: KinNode = { id: 'kid', displayName: 'Kid', keyed: false };

describe('ancestorSlots', () => {
  it('returns nothing without a self node', () => {
    const g = graphOf([me], []);
    expect(ancestorSlots(g, null)).toEqual([]);
  });

  it('offers two parent slots for a lone self', () => {
    const g = graphOf([me], []);
    const slots = ancestorSlots(g, 'me');
    expect(slots).toHaveLength(2);
    expect(slots.every((s) => s.childId === 'me')).toBe(true);
    expect(slots.map((s) => s.childName)).toEqual(['Me', 'Me']);
  });

  it('offers the second parent slot when only one parent is known', () => {
    const g = graphOf([me, mom], [['mom', 'me']]);
    const slots = ancestorSlots(g, 'me');
    // one remaining parent slot for me, plus two grandparent slots for mom
    expect(slots.filter((s) => s.childId === 'me')).toHaveLength(1);
    expect(slots.filter((s) => s.childId === 'mom')).toHaveLength(2);
  });

  it('offers no parent slots once both parents are known', () => {
    const g = graphOf([me, mom, dad], [['mom', 'me'], ['dad', 'me']]);
    const slots = ancestorSlots(g, 'me');
    expect(slots.filter((s) => s.childId === 'me')).toHaveLength(0);
    // but mom and dad each still want their two parents (your grandparents)
    expect(slots.filter((s) => s.childId === 'mom')).toHaveLength(2);
    expect(slots.filter((s) => s.childId === 'dad')).toHaveLength(2);
  });

  it('does not offer slots for descendants (only above you)', () => {
    const g = graphOf([me, kid], [['me', 'kid']]);
    const slots = ancestorSlots(g, 'me');
    expect(slots.some((s) => s.childId === 'kid')).toBe(false);
  });

  it('stops above grandparents (does not fill great-grandparents)', () => {
    const g = graphOf(
      [me, mom, { id: 'gma', displayName: 'Grandma', keyed: false }],
      [['mom', 'me'], ['gma', 'mom']],
    );
    const slots = ancestorSlots(g, 'me');
    // gma is generation 2 -> her parent slots are NOT offered
    expect(slots.some((s) => s.childId === 'gma')).toBe(false);
  });
});

describe('withAncestorSlots', () => {
  it('returns the same graph object when there is nothing to fill', () => {
    const g = graphOf([me, mom, dad], [['mom', 'me'], ['dad', 'me']]);
    // me is full; mom/dad still get grandparent slots, so this DOES augment
    expect(withAncestorSlots(g, 'me')).not.toBe(g);
  });

  it('returns the identical object when no self node', () => {
    const g = graphOf([me], []);
    expect(withAncestorSlots(g, null)).toBe(g);
  });

  it('injects placeholder nodes + parent edges without mutating the original', () => {
    const g = graphOf([me], []);
    const before = g.nodes.size;
    const aug = withAncestorSlots(g, 'me');
    expect(g.nodes.size).toBe(before); // original untouched
    expect(aug.nodes.size).toBe(before + 2);
    const placeholders = [...aug.nodes.values()].filter(
      (n) => n.placeholderFor === 'me',
    );
    expect(placeholders).toHaveLength(2);
    // each placeholder is a recorded parent of me
    expect(aug.parents.get('me')?.size).toBe(2);
    for (const p of placeholders) {
      expect(aug.children.get(p.id)?.has('me')).toBe(true);
    }
  });
});
