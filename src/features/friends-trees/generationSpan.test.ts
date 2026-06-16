import { describe, it, expect } from 'vitest';
import { generationSpan } from './generationSpan.ts';
import type { MinimalTreeProjection } from './familyTreeProjection.ts';

function proj(
  nodeIds: string[],
  edges: MinimalTreeProjection['edges'],
): MinimalTreeProjection {
  return {
    nodes: nodeIds.map((id) => ({ id, firstName: id })),
    edges,
    anchorNodeId: null,
    anchorPubkey: null,
  };
}

describe('generationSpan', () => {
  it('is 0 for an empty projection', () => {
    expect(generationSpan(proj([], []))).toBe(0);
  });

  it('is 1 for people with no parent links', () => {
    expect(generationSpan(proj(['a', 'b', 'c'], []))).toBe(1);
  });

  it('counts a three-generation line', () => {
    // grand -> dad -> me
    const p = proj(
      ['grand', 'dad', 'me'],
      [
        { relation: 'parent_of', from: 'grand', to: 'dad' },
        { relation: 'parent_of', from: 'dad', to: 'me' },
      ],
    );
    expect(generationSpan(p)).toBe(3);
  });

  it('takes the longest line, not the count of edges', () => {
    // dad -> me, mom -> me (two parents, still 2 generations deep)
    const p = proj(
      ['dad', 'mom', 'me'],
      [
        { relation: 'parent_of', from: 'dad', to: 'me' },
        { relation: 'parent_of', from: 'mom', to: 'me' },
      ],
    );
    expect(generationSpan(p)).toBe(2);
  });

  it('ignores spouse edges for depth', () => {
    const p = proj(
      ['a', 'b'],
      [{ relation: 'spouse', from: 'a', to: 'b' }],
    );
    expect(generationSpan(p)).toBe(1);
  });

  it('is cycle-safe', () => {
    const p = proj(
      ['a', 'b'],
      [
        { relation: 'parent_of', from: 'a', to: 'b' },
        { relation: 'parent_of', from: 'b', to: 'a' },
      ],
    );
    // Does not hang; returns a finite count.
    expect(generationSpan(p)).toBeGreaterThanOrEqual(1);
  });
});
