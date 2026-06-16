import { describe, it, expect } from 'vitest';
import type { Attestation } from 'tapit-attest';
import { envelopeId } from 'tapit-attest';
import {
  buildPersonEditDraft,
  isPersonEdit,
  readPersonEdit,
  foldPersonEdits,
  readPersonChanges,
  type PersonEditView,
} from './personEdit.ts';
import { buildPersonNodeDraft } from './personNode.ts';
import { buildParentEdgeDraft } from './kinEdge.ts';
import { buildKinGraph } from './kinGraph.ts';
import type { PersonNodeView } from './personNode.ts';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);

function sign(att: Attestation, ...signers: string[]): Attestation {
  return {
    ...att,
    signatures: signers.map((s) => ({ signer: s, sig: 'f'.repeat(128) })),
  };
}

function editView(
  partial: Partial<PersonEditView> & { editsNode: string },
): PersonEditView {
  return {
    id: Math.random().toString(36).slice(2),
    state: { displayName: 'X' },
    signers: [A],
    issuedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

const base: PersonNodeView = {
  displayName: 'Pam',
  born: '1950-01-01',
  keyed: false,
};

describe('buildPersonEditDraft / readPersonEdit', () => {
  it('round-trips a details edit', () => {
    const draft = buildPersonEditDraft(A, 'node1', {
      displayName: 'Pamela Winchester',
      born: '1950-02-02',
      sex: 'female',
    });
    const att = sign(draft, A);
    expect(isPersonEdit(att)).toBe(true);
    const view = readPersonEdit(att);
    expect(view?.editsNode).toBe('node1');
    expect(view?.state.displayName).toBe('Pamela Winchester');
    expect(view?.state.born).toBe('1950-02-02');
    expect(view?.state.sex).toBe('female');
    expect(view?.state.removed).toBeUndefined();
    expect(view?.signers).toEqual([A]);
  });

  it('round-trips a removal', () => {
    const draft = buildPersonEditDraft(A, 'node1', {
      removed: true,
      displayName: 'Oops',
    });
    const view = readPersonEdit(sign(draft, A));
    expect(view?.state.removed).toBe(true);
  });

  it('throws on empty target or empty name', () => {
    expect(() => buildPersonEditDraft(A, '  ', { displayName: 'X' })).toThrow();
    expect(() => buildPersonEditDraft(A, 'n', { displayName: '  ' })).toThrow();
  });
});

describe('foldPersonEdits', () => {
  it('applies a solo signer edit immediately', () => {
    const r = foldPersonEdits(base, [A], [
      editView({ editsNode: 'n', state: { displayName: 'Pam W.' }, signers: [A] }),
    ]);
    expect(r.view.displayName).toBe('Pam W.');
    expect(r.requiresCosign).toBe(false);
    expect(r.history[0]?.applied).toBe(true);
  });

  it('latest issued correction wins', () => {
    const r = foldPersonEdits(base, [A], [
      editView({
        editsNode: 'n',
        state: { displayName: 'First' },
        signers: [A],
        issuedAt: '2026-01-01T00:00:00.000Z',
      }),
      editView({
        editsNode: 'n',
        state: { displayName: 'Second' },
        signers: [A],
        issuedAt: '2026-02-01T00:00:00.000Z',
      }),
    ]);
    expect(r.view.displayName).toBe('Second');
  });

  it('clears a field omitted from the latest snapshot', () => {
    const r = foldPersonEdits(base, [A], [
      editView({ editsNode: 'n', state: { displayName: 'Pam' }, signers: [A] }),
    ]);
    expect(r.view.born).toBeUndefined();
  });

  it('removes a person on a removal correction', () => {
    const r = foldPersonEdits(base, [A], [
      editView({ editsNode: 'n', state: { removed: true }, signers: [A] }),
    ]);
    expect(r.removed).toBe(true);
  });

  it('keeps solo edits applying without escalating', () => {
    const r = foldPersonEdits(base, [A], [
      editView({ editsNode: 'n', state: { displayName: 'One' }, signers: [A] }),
      editView({
        editsNode: 'n',
        state: { displayName: 'Two' },
        signers: [A],
        issuedAt: '2026-03-01T00:00:00.000Z',
      }),
    ]);
    expect(r.view.displayName).toBe('Two');
    expect(r.requiresCosign).toBe(false);
  });

  it('holds an under-signed edit pending once two signers control the node', () => {
    // base already co-signed by A and B -> co-sign required.
    const r = foldPersonEdits(base, [A, B], [
      editView({ editsNode: 'n', state: { displayName: 'Solo' }, signers: [A] }),
    ]);
    expect(r.requiresCosign).toBe(true);
    expect(r.view.displayName).toBe('Pam'); // unchanged
    expect(r.history[0]?.applied).toBe(false);
  });

  it('applies an edit signed by all controlling signers', () => {
    const r = foldPersonEdits(base, [A, B], [
      editView({ editsNode: 'n', state: { displayName: 'Agreed' }, signers: [A, B] }),
    ]);
    expect(r.view.displayName).toBe('Agreed');
    expect(r.history[0]?.applied).toBe(true);
  });
});

describe('buildKinGraph with corrections', () => {
  it('renders the corrected name and drops removed nodes', () => {
    const parent = sign(
      buildPersonNodeDraft(A, { displayName: 'Mom', keyedPubkey: A }),
      A,
    );
    const child = sign(buildPersonNodeDraft(A, { displayName: 'Kidd' }), A);
    const parentId = envelopeId(parent);
    const childId = envelopeId(child);
    const edge = sign(buildParentEdgeDraft(A, parentId, childId), A);
    const rename = sign(
      buildPersonEditDraft(A, childId, { displayName: 'Kid Fixed' }),
      A,
    );
    const g1 = buildKinGraph([parent, child, edge, rename]);
    expect(g1.nodes.get(childId)?.displayName).toBe('Kid Fixed');

    const remove = sign(
      buildPersonEditDraft(A, childId, { removed: true }),
      A,
    );
    // removal issued after the rename
    remove.issuedAt = '2027-01-01T00:00:00.000Z';
    const g2 = buildKinGraph([parent, child, edge, rename, remove]);
    expect(g2.nodes.has(childId)).toBe(false);
  });

  it('readPersonChanges surfaces history + governance verdict', () => {
    const node = sign(buildPersonNodeDraft(A, { displayName: 'Gramps' }), A, B);
    const nodeId = envelopeId(node);
    const edit = sign(
      buildPersonEditDraft(A, nodeId, { displayName: 'Grandpa' }),
      A,
    );
    const fold = readPersonChanges([node, edit], [nodeId], {
      displayName: 'Gramps',
      keyed: false,
    });
    expect(fold.requiresCosign).toBe(true);
    expect(fold.history).toHaveLength(1);
    expect(fold.history[0]?.applied).toBe(false); // needs B's signature too
  });
});
