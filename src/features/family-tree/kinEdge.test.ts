import { describe, it, expect } from 'vitest';
import {
  buildParentEdgeDraft,
  buildSpouseEdgeDraft,
  isKinEdge,
  readKinEdge,
} from './kinEdge.ts';

const AUTHOR = 'a'.repeat(64);
const N1 = 'node-1';
const N2 = 'node-2';

describe('buildParentEdgeDraft', () => {
  it('builds a relationship-kind parent_of edge', () => {
    const draft = buildParentEdgeDraft(AUTHOR, N1, N2);
    expect(draft.kind).toBe('relationship');
    expect(isKinEdge(draft)).toBe(true);
    const edge = readKinEdge(draft);
    expect(edge).toEqual({ relation: 'parent_of', from: N1, to: N2 });
  });

  it('throws on empty ids', () => {
    expect(() => buildParentEdgeDraft(AUTHOR, '', N2)).toThrow();
  });

  it('throws on a self-edge', () => {
    expect(() => buildParentEdgeDraft(AUTHOR, N1, N1)).toThrow();
  });
});

describe('buildSpouseEdgeDraft', () => {
  it('builds a spouse edge', () => {
    const draft = buildSpouseEdgeDraft(AUTHOR, N1, N2);
    expect(isKinEdge(draft)).toBe(true);
    expect(readKinEdge(draft)).toEqual({
      relation: 'spouse',
      from: N1,
      to: N2,
    });
  });
});

describe('readKinEdge', () => {
  it('returns null when the relation is missing', () => {
    const draft = buildParentEdgeDraft(AUTHOR, N1, N2);
    const claim = draft.claim as { children: { name: string; value: unknown }[] };
    const leaf = claim.children.find((c) => c.name === 'kin_relation');
    if (leaf) leaf.value = 'not_a_relation';
    expect(isKinEdge(draft)).toBe(false);
    expect(readKinEdge(draft)).toBeNull();
  });
});
