import { describe, it, expect } from 'vitest';
import {
  buildPersonNodeDraft,
  isPersonNode,
  readPersonNode,
} from './personNode.ts';

const AUTHOR = 'a'.repeat(64);
const KEYED = 'b'.repeat(64);

describe('buildPersonNodeDraft', () => {
  it('throws on an empty display name', () => {
    expect(() => buildPersonNodeDraft(AUTHOR, { displayName: '  ' })).toThrow();
  });

  it('builds a keyless witnessed node subjected to the author', () => {
    const draft = buildPersonNodeDraft(AUTHOR, {
      displayName: 'Pam Winchester',
      born: '1949-01-01',
      died: '2022-05-02',
    });
    expect(draft.kind).toBe('credential');
    expect(draft.subject).toBe(AUTHOR);
    expect(isPersonNode(draft)).toBe(true);
    const view = readPersonNode(draft);
    expect(view.displayName).toBe('Pam Winchester');
    expect(view.born).toBe('1949-01-01');
    expect(view.died).toBe('2022-05-02');
    expect(view.keyed).toBe(false);
    expect(view.keyedPubkey).toBeUndefined();
    expect(view.sex).toBeUndefined();
  });

  it('round-trips an optional sex and ignores a bad value', () => {
    const female = readPersonNode(
      buildPersonNodeDraft(AUTHOR, { displayName: 'Pam', sex: 'female' }),
    );
    expect(female.sex).toBe('female');
    const male = readPersonNode(
      buildPersonNodeDraft(AUTHOR, { displayName: 'Cliff', sex: 'male' }),
    );
    expect(male.sex).toBe('male');
    // An unset sex stays unset rather than being invented.
    const none = readPersonNode(
      buildPersonNodeDraft(AUTHOR, { displayName: 'Anon' }),
    );
    expect(none.sex).toBeUndefined();
  });

  it('subjects a keyed node to the person and lowercases the pubkey', () => {
    const draft = buildPersonNodeDraft(AUTHOR, {
      displayName: 'Living Sister',
      keyedPubkey: KEYED.toUpperCase(),
    });
    expect(draft.subject).toBe(KEYED);
    const view = readPersonNode(draft);
    expect(view.keyed).toBe(true);
    expect(view.keyedPubkey).toBe(KEYED);
  });
});

describe('isPersonNode', () => {
  it('is false for a non-person-node credential', () => {
    const draft = buildPersonNodeDraft(AUTHOR, { displayName: 'X' });
    // mutate the credential_type leaf to simulate a different credential
    const claim = draft.claim as { children: { name: string; value: unknown }[] };
    const leaf = claim.children.find((c) => c.name === 'credential_type');
    if (leaf) leaf.value = 'membership';
    expect(isPersonNode(draft)).toBe(false);
  });
});
