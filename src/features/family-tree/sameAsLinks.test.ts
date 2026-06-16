import { describe, it, expect } from 'vitest';
import { journalAttestation, type Attestation } from 'tapit-attest';
import {
  buildSameAsEdgeDraft,
  buildParentEdgeDraft,
} from './kinEdge.ts';
import { buildPersonNodeDraft } from './personNode.ts';
import {
  heldSameAsPairs,
  isSameAsLinked,
  pairIsLinked,
} from './sameAsLinks.ts';

const AUTHOR = 'a'.repeat(64);
const MINE = 'mine-node-id';
const THEIRS = 'theirs-node-id';
const OTHER = 'other-node-id';

// isKinEdge / readKinEdge inspect kind + leaf values, not signatures, so the
// unsigned drafts are sufficient holdings fixtures for these pure readers.

describe('heldSameAsPairs', () => {
  it('collects only same_as edges, ignoring other holdings', () => {
    const holdings: Attestation[] = [
      buildSameAsEdgeDraft(AUTHOR, MINE, THEIRS),
      buildParentEdgeDraft(AUTHOR, MINE, OTHER), // parent_of, not same_as
      buildPersonNodeDraft(AUTHOR, { displayName: 'Pam' }), // not an edge
      journalAttestation({
        subject: AUTHOR,
        tier: 'routine',
        fields: { text: 'a moment' },
      }), // unrelated
    ];
    const pairs = heldSameAsPairs(holdings);
    expect(pairs.size).toBe(1);
  });

  it('is empty when no same_as edges are held', () => {
    const holdings: Attestation[] = [
      buildParentEdgeDraft(AUTHOR, MINE, OTHER),
    ];
    expect(heldSameAsPairs(holdings).size).toBe(0);
  });
});

describe('isSameAsLinked', () => {
  it('is true for a held pair regardless of argument order', () => {
    const holdings = [buildSameAsEdgeDraft(AUTHOR, MINE, THEIRS)];
    expect(isSameAsLinked(holdings, MINE, THEIRS)).toBe(true);
    expect(isSameAsLinked(holdings, THEIRS, MINE)).toBe(true);
  });

  it('is true even when the edge was authored in the opposite direction', () => {
    const holdings = [buildSameAsEdgeDraft(AUTHOR, THEIRS, MINE)];
    expect(isSameAsLinked(holdings, MINE, THEIRS)).toBe(true);
  });

  it('is false for a pair that is not bound', () => {
    const holdings = [buildSameAsEdgeDraft(AUTHOR, MINE, THEIRS)];
    expect(isSameAsLinked(holdings, MINE, OTHER)).toBe(false);
  });

  it('is false for a self-pair', () => {
    const holdings = [buildSameAsEdgeDraft(AUTHOR, MINE, THEIRS)];
    expect(isSameAsLinked(holdings, MINE, MINE)).toBe(false);
  });

  it('is false against empty holdings', () => {
    expect(isSameAsLinked([], MINE, THEIRS)).toBe(false);
  });
});

describe('pairIsLinked', () => {
  it('reads a precomputed set order-insensitively', () => {
    const set = heldSameAsPairs([buildSameAsEdgeDraft(AUTHOR, MINE, THEIRS)]);
    expect(pairIsLinked(set, MINE, THEIRS)).toBe(true);
    expect(pairIsLinked(set, THEIRS, MINE)).toBe(true);
    expect(pairIsLinked(set, MINE, OTHER)).toBe(false);
  });
});
