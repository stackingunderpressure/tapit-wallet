import { describe, it, expect } from 'vitest';
import type { Wallet } from 'tapit-attest';
import { addRelativeNode } from './createFamilyTree.ts';

// A wallet stub that fails loudly if anything tries to sign — used to prove
// the sibling guard rejects BEFORE any node/edge is written, so a bad add
// never orphans a person-node.
const NEVER_SIGNS = {
  identity: 'a'.repeat(64),
  sign() {
    throw new Error('addRelativeNode signed before validating');
  },
  async hold() {},
} as unknown as Wallet;

describe('addRelativeNode — sibling guard', () => {
  it('rejects a sibling with no shared parent, before any signing I/O', async () => {
    await expect(
      addRelativeNode(NEVER_SIGNS, 'owner', null, {
        relation: 'sibling',
        targetId: 'b'.repeat(64),
        targetParentId: null,
        person: { displayName: 'A Sibling' },
      }),
    ).rejects.toThrow(/Add a parent for this person first/);
  });
});
