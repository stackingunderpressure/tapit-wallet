import { describe, it, expect } from 'vitest';
import { Wallet, envelopeId } from 'tapit-attest';
import {
  buildKinGraph,
  relationshipLabel,
  generationOf,
  type KinGraph,
} from './kinGraph.ts';
import { buildPersonNodeDraft } from './personNode.ts';
import {
  buildParentEdgeDraft,
  buildSameAsEdgeDraft,
} from './kinEdge.ts';

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

describe('generationOf', () => {
  const g = family();
  it('parent is +1, grandparent +2, great-grandparent +3', () => {
    expect(generationOf(g, 'me', 'p1')).toBe(1);
    expect(generationOf(g, 'me', 'gp')).toBe(2);
    expect(generationOf(g, 'me', 'ggp')).toBe(3);
  });
  it('child is -1', () => expect(generationOf(g, 'p1', 'me')).toBe(-1));
  it('sibling and cousin are same generation (0)', () => {
    expect(generationOf(g, 'me', 'sib')).toBe(0);
    expect(generationOf(g, 'me', 'cousin1')).toBe(0);
  });
  it('aunt/uncle is +1, niece/nephew is -1', () => {
    expect(generationOf(g, 'me', 'p2')).toBe(1);
    expect(generationOf(g, 'me', 'sib_child')).toBe(-1);
  });
  it('first cousin once removed (younger) is -1', () =>
    expect(generationOf(g, 'me', 'cousin1_child')).toBe(-1));
  it('spouse and sibling-in-law are same generation (0)', () => {
    expect(generationOf(g, 'me', 'me_spouse')).toBe(0);
    expect(generationOf(g, 'me', 'sib_spouse')).toBe(0);
  });
  it('null for an unrelated node', () =>
    expect(generationOf(g, 'me', 'stranger')).toBeNull());
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

  it('fuses two person-nodes joined by a same_as edge into one canonical node', () => {
    const w = Wallet.generate();
    // Two separately-created "Pam" nodes (e.g. mine + my sister's), one
    // carrying the birth date, then a human-confirmed same_as binding.
    const pamA = w.sign(
      buildPersonNodeDraft(w.identity, { displayName: 'Pam' }),
    );
    const pamB = w.sign(
      buildPersonNodeDraft(w.identity, { displayName: 'Pam', born: '1949-01-01' }),
    );
    const idA = envelopeId(pamA);
    const idB = envelopeId(pamB);
    const bind = w.sign(buildSameAsEdgeDraft(w.identity, idA, idB));

    const graph = buildKinGraph([pamA, pamB, bind]);
    // Exactly one canonical node, carrying both ids as aliases and the
    // merged birth date.
    expect(graph.nodes.size).toBe(1);
    const node = [...graph.nodes.values()][0];
    expect(node?.aliasIds?.slice().sort()).toEqual([idA, idB].sort());
    expect(node?.born).toBe('1949-01-01');
  });
});
