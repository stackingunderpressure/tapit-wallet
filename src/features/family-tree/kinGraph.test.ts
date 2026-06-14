import { describe, it, expect } from 'vitest';
import { Wallet, envelopeId } from 'tapit-attest';
import { buildKinGraph, relationshipLabel, type KinGraph } from './kinGraph.ts';
import { buildPersonNodeDraft } from './personNode.ts';
import { buildParentEdgeDraft } from './kinEdge.ts';

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
function spouse(g: KinGraph, a: string, b: string) {
  add(g.spouses, a, b);
  add(g.spouses, b, a);
}

// A hand-built family:
//   ggp ─┬─ gp ───┬─ p1 ──┬─ me ── me_spouse
//        │        │       ├─ sib ── sib_spouse
//        │        │       │   └─ sib_child
//        │        └─ p2 ──┴─ cousin1 ── cousin1_child
//        └─ gp_sib ─ p3 ── cousin2
function family(): KinGraph {
  const g = emptyGraph();
  parent(g, 'ggp', 'gp');
  parent(g, 'ggp', 'gp_sib');
  parent(g, 'gp', 'p1');
  parent(g, 'gp', 'p2');
  parent(g, 'gp_sib', 'p3');
  parent(g, 'p1', 'me');
  parent(g, 'p1', 'sib');
  parent(g, 'p2', 'cousin1');
  parent(g, 'p3', 'cousin2');
  parent(g, 'sib', 'sib_child');
  parent(g, 'cousin1', 'cousin1_child');
  spouse(g, 'me', 'me_spouse');
  spouse(g, 'sib', 'sib_spouse');
  return g;
}

describe('relationshipLabel — direct line', () => {
  const g = family();
  it('names self', () => expect(relationshipLabel(g, 'me', 'me')).toBe('you'));
  it('parent', () => expect(relationshipLabel(g, 'me', 'p1')).toBe('parent'));
  it('grandparent', () =>
    expect(relationshipLabel(g, 'me', 'gp')).toBe('grandparent'));
  it('great-grandparent', () =>
    expect(relationshipLabel(g, 'me', 'ggp')).toBe('great-grandparent'));
  it('child', () => expect(relationshipLabel(g, 'p1', 'me')).toBe('child'));
  it('grandchild', () =>
    expect(relationshipLabel(g, 'gp', 'me')).toBe('grandchild'));
});

describe('relationshipLabel — collateral blood', () => {
  const g = family();
  it('sibling', () => expect(relationshipLabel(g, 'me', 'sib')).toBe('sibling'));
  it('aunt/uncle', () =>
    expect(relationshipLabel(g, 'me', 'p2')).toBe('aunt/uncle'));
  it('niece/nephew', () =>
    expect(relationshipLabel(g, 'me', 'sib_child')).toBe('niece/nephew'));
  it('first cousin', () =>
    expect(relationshipLabel(g, 'me', 'cousin1')).toBe('1st cousin'));
  it('first cousin once removed', () =>
    expect(relationshipLabel(g, 'me', 'cousin1_child')).toBe(
      '1st cousin 1x removed',
    ));
  it('second cousin', () =>
    expect(relationshipLabel(g, 'me', 'cousin2')).toBe('2nd cousin'));
});

describe('relationshipLabel — affinity', () => {
  const g = family();
  it('spouse', () =>
    expect(relationshipLabel(g, 'me', 'me_spouse')).toBe('spouse'));
  it('sibling-in-law (spouse of my sibling)', () =>
    expect(relationshipLabel(g, 'me', 'sib_spouse')).toBe('sibling-in-law'));
  it('null for an unrelated node', () =>
    expect(relationshipLabel(g, 'me', 'stranger')).toBeNull());
});

describe('buildKinGraph round-trip with signed attestations', () => {
  it('reads person-nodes + a parent edge and names the tie', () => {
    const w = Wallet.generate();
    const pam = w.sign(buildPersonNodeDraft(w.identity, { displayName: 'Pam' }));
    const me = w.sign(
      buildPersonNodeDraft(w.identity, {
        displayName: 'Me',
        keyedPubkey: w.identity,
      }),
    );
    const pamId = envelopeId(pam);
    const meId = envelopeId(me);
    const edge = w.sign(buildParentEdgeDraft(w.identity, pamId, meId));

    const graph = buildKinGraph([pam, me, edge]);
    expect(graph.nodes.has(pamId)).toBe(true);
    expect(graph.nodes.get(meId)?.keyed).toBe(true);
    expect(relationshipLabel(graph, meId, pamId)).toBe('parent');
    expect(relationshipLabel(graph, pamId, meId)).toBe('child');
  });
});
