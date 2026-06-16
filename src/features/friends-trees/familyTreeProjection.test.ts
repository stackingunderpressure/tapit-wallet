import { describe, it, expect } from 'vitest';
import { Wallet, envelopeId, type Attestation } from 'tapit-attest';
import { buildPersonNodeDraft } from '../family-tree/personNode.ts';
import { buildParentEdgeDraft, buildSpouseEdgeDraft } from '../family-tree/kinEdge.ts';
import {
  buildMinimalProjection,
  kinGraphFromProjection,
} from './familyTreeProjection.ts';
import { buildFamilyTreeBundleDraft } from './familyTreeBundle.ts';

// THE CORE LEAK-TEST. A minimal share must NEVER carry: any surname (anything
// past the first name token), any born/died value, any sex, or any keyedPubkey
// other than the single shared-anchor's. The redaction happens at BUILD TIME on
// the sender, so we prove it by SERIALIZING the built draft and asserting the
// sensitive strings are physically absent from the bytes that would cross the
// wire — while the first names and the structure ARE present.

// A rich fixture tree:
//   self  = the sender, keyed to their identity (the shared anchor)
//   pam   = "Pam Winchester", born 1950-03-14, died 2010-08-02, female,
//           AND keyed to a DECOY pubkey that must NOT survive redaction
//   dad   = "Bob Winchester", born 1948-01-01, male, keyed to ANOTHER decoy key
// Edges: dad parent_of self, pam parent_of self, dad spouse pam.
function makeRichTree(w: Wallet) {
  const decoyPamKey = 'a'.repeat(64);
  const decoyDadKey = 'b'.repeat(64);

  const self = w.sign(
    buildPersonNodeDraft(w.identity, {
      displayName: 'Thomas Winchester',
      keyedPubkey: w.identity,
    }),
  );
  const pam = w.sign(
    buildPersonNodeDraft(w.identity, {
      displayName: 'Pam Winchester',
      born: '1950-03-14',
      died: '2010-08-02',
      sex: 'female',
      keyedPubkey: decoyPamKey,
    }),
  );
  const dad = w.sign(
    buildPersonNodeDraft(w.identity, {
      displayName: 'Bob Winchester',
      born: '1948-01-01',
      sex: 'male',
      keyedPubkey: decoyDadKey,
    }),
  );
  const selfId = envelopeId(self);
  const pamId = envelopeId(pam);
  const dadId = envelopeId(dad);
  const edges = [
    w.sign(buildParentEdgeDraft(w.identity, pamId, selfId)),
    w.sign(buildParentEdgeDraft(w.identity, dadId, selfId)),
    w.sign(buildSpouseEdgeDraft(w.identity, dadId, pamId)),
  ];
  return {
    trees: [self, pam, dad, ...edges] as Attestation[],
    selfId,
    pamId,
    dadId,
    decoyPamKey,
    decoyDadKey,
  };
}

describe('familyTreeProjection — LEAK TEST (privacy rail #1)', () => {
  it('a serialized minimal draft contains first names + structure but NOT surnames, dates, sex, or non-anchor keys', () => {
    const w = Wallet.generate();
    const fix = makeRichTree(w);

    const projection = buildMinimalProjection(fix.trees, w.identity);
    const draft = buildFamilyTreeBundleDraft(w.identity, {
      projection,
      rootNodeId: fix.selfId,
      sharerName: 'Thomas',
    });
    const signed = w.sign(draft);

    // The bytes that would cross the wire — the whole signed envelope.
    const wire = JSON.stringify(signed);

    // MUST NOT leak: the surname.
    expect(wire).not.toContain('Winchester');
    // MUST NOT leak: any birth or death date.
    expect(wire).not.toContain('1950-03-14');
    expect(wire).not.toContain('2010-08-02');
    expect(wire).not.toContain('1948-01-01');
    // MUST NOT leak: sex.
    expect(wire).not.toContain('female');
    expect(wire).not.toContain('male');
    // MUST NOT leak: the non-anchor wallet keys.
    expect(wire).not.toContain(fix.decoyPamKey);
    expect(wire).not.toContain(fix.decoyDadKey);

    // MUST carry: the first names.
    expect(wire).toContain('Thomas');
    expect(wire).toContain('Pam');
    expect(wire).toContain('Bob');
    // MUST carry: the structure (the node ids that the edges connect).
    expect(wire).toContain(fix.selfId);
    expect(wire).toContain(fix.pamId);
    expect(wire).toContain(fix.dadId);
    // MUST carry: the single shared-anchor key (the sender's own identity).
    expect(wire).toContain(w.identity);
  });

  it('the projection object itself carries no sensitive fields', () => {
    const w = Wallet.generate();
    const fix = makeRichTree(w);
    const projection = buildMinimalProjection(fix.trees, w.identity);

    // Every node is id + firstName ONLY — no born/died/sex/surname/keyedPubkey.
    for (const node of projection.nodes) {
      expect(Object.keys(node).sort()).toEqual(['firstName', 'id']);
      expect(node.firstName).not.toContain(' '); // first token only
      expect(node.firstName).not.toContain('Winchester');
    }
    // Anchor is the sender's own key; that is the ONLY key in the payload.
    expect(projection.anchorPubkey?.toLowerCase()).toBe(
      w.identity.toLowerCase(),
    );
    const json = JSON.stringify(projection);
    expect(json).not.toContain(fix.decoyPamKey);
    expect(json).not.toContain(fix.decoyDadKey);
  });

  it('preserves the structure: parent_of and spouse edges survive', () => {
    const w = Wallet.generate();
    const fix = makeRichTree(w);
    const projection = buildMinimalProjection(fix.trees, w.identity);

    const parentEdges = projection.edges.filter((e) => e.relation === 'parent_of');
    const spouseEdges = projection.edges.filter((e) => e.relation === 'spouse');
    // Two parent_of (pam->self, dad->self) and one spouse (dad<->pam).
    expect(parentEdges).toHaveLength(2);
    expect(spouseEdges).toHaveLength(1);
    // The anchor node id is the sender's self-node.
    expect(projection.anchorNodeId).toBe(fix.selfId);
  });
});

describe('familyTreeProjection — kinGraphFromProjection (receiver render)', () => {
  it('rebuilds a renderable graph with only the anchor keyed', () => {
    const w = Wallet.generate();
    const fix = makeRichTree(w);
    const projection = buildMinimalProjection(fix.trees, w.identity);

    const graph = kinGraphFromProjection(projection);
    // All three people present, first names only.
    expect(graph.nodes.size).toBe(3);
    expect(graph.nodes.get(fix.selfId)?.displayName).toBe('Thomas');
    expect(graph.nodes.get(fix.pamId)?.displayName).toBe('Pam');
    // born/died/sex stripped — never crossed the wire.
    expect(graph.nodes.get(fix.pamId)?.born).toBeUndefined();
    expect(graph.nodes.get(fix.pamId)?.died).toBeUndefined();
    expect(graph.nodes.get(fix.pamId)?.sex).toBeUndefined();
    // Only the anchor node is keyed; everyone else is keyless.
    expect(graph.nodes.get(fix.selfId)?.keyed).toBe(true);
    expect(graph.nodes.get(fix.selfId)?.keyedPubkey?.toLowerCase()).toBe(
      w.identity.toLowerCase(),
    );
    expect(graph.nodes.get(fix.pamId)?.keyed).toBe(false);
    expect(graph.nodes.get(fix.dadId)?.keyed).toBe(false);
    // Structure rebuilt: self has two parents and one spouse pair exists.
    expect(graph.parents.get(fix.selfId)?.size).toBe(2);
    expect(graph.spouses.get(fix.dadId)?.has(fix.pamId)).toBe(true);
  });
});
