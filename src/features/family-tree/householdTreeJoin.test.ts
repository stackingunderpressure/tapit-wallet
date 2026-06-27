import { describe, it, expect } from 'vitest';
import { envelopeId, credentialAttestation } from 'tapit-attest';
import { buildPersonNodeDraft } from './personNode.ts';
import {
  keyedNodeIndex,
  treeNodeForPubkey,
  roleToTreeRelation,
} from './householdTreeJoin.ts';
import { FAMILY_ROLES } from '../connections/familyUnit.ts';

const AUTHOR = 'a'.repeat(64);
const KEYED_1 = 'b'.repeat(64);
const KEYED_2 = 'c'.repeat(64);
const ABSENT = 'd'.repeat(64);

describe('keyedNodeIndex', () => {
  it('indexes keyed person-nodes by pubkey → node id and skips keyless ones', () => {
    const keyed1 = buildPersonNodeDraft(AUTHOR, {
      displayName: 'Keyed One',
      keyedPubkey: KEYED_1,
    });
    const keyed2 = buildPersonNodeDraft(AUTHOR, {
      displayName: 'Keyed Two',
      keyedPubkey: KEYED_2,
    });
    const keyless = buildPersonNodeDraft(AUTHOR, { displayName: 'Pam (no key)' });

    const index = keyedNodeIndex([keyed1, keyless, keyed2]);

    expect(index.size).toBe(2);
    expect(index.get(KEYED_1)).toBe(envelopeId(keyed1));
    expect(index.get(KEYED_2)).toBe(envelopeId(keyed2));
  });

  it('ignores holdings that are not person-nodes', () => {
    const node = buildPersonNodeDraft(AUTHOR, {
      displayName: 'Keyed One',
      keyedPubkey: KEYED_1,
    });
    // A different credential — must never land in the index.
    const other = credentialAttestation({
      subject: AUTHOR,
      tier: 'notable',
      fields: { credential_type: 'family_unit', members: '[]' },
    });

    const index = keyedNodeIndex([node, other]);

    expect(index.size).toBe(1);
    expect(index.get(KEYED_1)).toBe(envelopeId(node));
  });

  it('returns an empty index for no holdings', () => {
    expect(keyedNodeIndex([]).size).toBe(0);
  });
});

describe('treeNodeForPubkey', () => {
  it('matches a member pubkey case-insensitively', () => {
    const node = buildPersonNodeDraft(AUTHOR, {
      displayName: 'Keyed One',
      keyedPubkey: KEYED_1,
    });
    const index = keyedNodeIndex([node]);

    // keyed_pubkey is stored lowercased; the lookup uppercases to prove
    // the helper normalizes the caller's input.
    expect(treeNodeForPubkey(index, KEYED_1.toUpperCase())).toBe(
      envelopeId(node),
    );
  });

  it('returns undefined when the person is not yet in the tree', () => {
    const node = buildPersonNodeDraft(AUTHOR, {
      displayName: 'Keyed One',
      keyedPubkey: KEYED_1,
    });
    const index = keyedNodeIndex([node]);

    expect(treeNodeForPubkey(index, ABSENT)).toBeUndefined();
  });
});

describe('roleToTreeRelation', () => {
  it('maps every household role to a tree relation (dad/mom/parent → parent)', () => {
    expect(roleToTreeRelation('dad')).toBe('parent');
    expect(roleToTreeRelation('mom')).toBe('parent');
    expect(roleToTreeRelation('parent')).toBe('parent');
    expect(roleToTreeRelation('child')).toBe('child');
    expect(roleToTreeRelation('spouse')).toBe('spouse');
    expect(roleToTreeRelation('sibling')).toBe('sibling');
  });

  it('handles the entire FAMILY_ROLES vocabulary with no gaps', () => {
    for (const role of FAMILY_ROLES) {
      expect(['parent', 'child', 'spouse', 'sibling']).toContain(
        roleToTreeRelation(role),
      );
    }
  });
});
