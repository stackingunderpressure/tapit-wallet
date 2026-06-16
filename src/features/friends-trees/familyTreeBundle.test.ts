import { describe, it, expect } from 'vitest';
import {
  Wallet,
  envelopeId,
  journalAttestation,
  type Attestation,
} from 'tapit-attest';
import { buildPersonNodeDraft } from '../family-tree/personNode.ts';
import { buildParentEdgeDraft } from '../family-tree/kinEdge.ts';
import {
  buildFamilyTreeBundleDraft,
  isFamilyTreeBundle,
  readFamilyTreeBundle,
  collectMyTreeAttestations,
  findMyRootNodeId,
} from './familyTreeBundle.ts';

// Build a small real tree for a wallet: a keyed self-node + a keyless parent
// + a parent_of edge. Returns the signed attestations and the self/parent ids.
function makeTree(w: Wallet) {
  const self = w.sign(
    buildPersonNodeDraft(w.identity, {
      displayName: 'Me',
      keyedPubkey: w.identity,
    }),
  );
  const parent = w.sign(
    buildPersonNodeDraft(w.identity, { displayName: 'Pam', born: '1950-01-01' }),
  );
  const selfId = envelopeId(self);
  const parentId = envelopeId(parent);
  const edge = w.sign(buildParentEdgeDraft(w.identity, parentId, selfId));
  return { trees: [self, parent, edge], selfId, parentId };
}

describe('familyTreeBundle — collectMyTreeAttestations (privacy rail #3)', () => {
  it('includes person-nodes, kin-edges, and person-edits; excludes everything else', () => {
    const w = Wallet.generate();
    const { trees } = makeTree(w);

    // A non-tree holding that MUST NOT be shared: a journal moment (the kind
    // storiesAbout binds to a person-node via subject_node). It is a 'journal'
    // kind attestation, so the family-tree predicates must reject it.
    const moment = w.sign(
      journalAttestation({
        subject: w.identity,
        tier: 'routine',
        fields: { text: 'a private memory' },
      }),
    );

    const holdings: Attestation[] = [...trees, moment];
    const collected = collectMyTreeAttestations(holdings, w.identity);

    expect(collected).toHaveLength(trees.length);
    expect(collected).not.toContain(moment);
    expect(collected.some((a) => a.kind === 'journal')).toBe(false);
  });
});

describe('familyTreeBundle — findMyRootNodeId', () => {
  it('finds the self person-node keyed to my identity', () => {
    const w = Wallet.generate();
    const { trees, selfId } = makeTree(w);
    expect(findMyRootNodeId(trees, w.identity)).toBe(selfId);
  });

  it('returns null when no self-node is keyed to me', () => {
    const w = Wallet.generate();
    const keyless = w.sign(buildPersonNodeDraft(w.identity, { displayName: 'Pam' }));
    expect(findMyRootNodeId([keyless], w.identity)).toBeNull();
  });
});

describe('familyTreeBundle — build -> read round-trip', () => {
  it('round-trips trees, rootNodeId, sharerName and attributes the envelope signer', () => {
    const w = Wallet.generate();
    const { trees, selfId } = makeTree(w);

    const draft = buildFamilyTreeBundleDraft(w.identity, {
      trees,
      rootNodeId: selfId,
      sharerName: 'Thomas',
    });
    const signed = w.sign(draft);

    expect(isFamilyTreeBundle(signed)).toBe(true);

    const view = readFamilyTreeBundle(signed, w.publicKey);
    expect(view.senderPubkey).toBe(w.publicKey);
    expect(view.rootNodeId).toBe(selfId);
    expect(view.sharerName).toBe('Thomas');
    expect(view.trees).toHaveLength(trees.length);
    // Content survived: the self-node id is recoverable from the parsed trees.
    expect(view.trees.map((a) => envelopeId(a))).toContain(selfId);
    expect(typeof view.sharedAt).toBe('string');
    expect(view.sharedAt.length).toBeGreaterThan(0);
  });

  it('handles a null rootNodeId', () => {
    const w = Wallet.generate();
    const { trees } = makeTree(w);
    const signed = w.sign(
      buildFamilyTreeBundleDraft(w.identity, {
        trees,
        rootNodeId: null,
        sharerName: 'Anon',
      }),
    );
    expect(readFamilyTreeBundle(signed, w.publicKey).rootNodeId).toBeNull();
  });
});

describe('familyTreeBundle — minimal vs full variant', () => {
  it('a full bundle reads back with projection null and isMinimal false', () => {
    const w = Wallet.generate();
    const { trees } = makeTree(w);
    const signed = w.sign(
      buildFamilyTreeBundleDraft(w.identity, {
        trees,
        rootNodeId: null,
        sharerName: 'Full',
      }),
    );
    const view = readFamilyTreeBundle(signed, w.publicKey);
    expect(view.isMinimal).toBe(false);
    expect(view.projection).toBeNull();
    expect(view.trees.length).toBe(trees.length);
  });

  it('a minimal bundle reads back with a projection and no full attestations', () => {
    const w = Wallet.generate();
    const projection = {
      nodes: [{ id: 'n1', firstName: 'Pam' }],
      edges: [],
      anchorNodeId: 'n1',
      anchorPubkey: w.identity,
    };
    const signed = w.sign(
      buildFamilyTreeBundleDraft(w.identity, {
        projection,
        rootNodeId: 'n1',
        sharerName: 'Min',
      }),
    );
    const view = readFamilyTreeBundle(signed, w.publicKey);
    expect(view.isMinimal).toBe(true);
    expect(view.trees).toEqual([]);
    expect(view.projection?.nodes[0]?.firstName).toBe('Pam');
    expect(view.projection?.anchorNodeId).toBe('n1');
  });

  it('BACKWARD COMPAT: a legacy full bundle with NO is_minimal leaf still reads as full', () => {
    // Simulate a slice-1 bundle: build full, then strip the is_minimal leaf
    // so the envelope looks exactly like one signed before this slice existed.
    const w = Wallet.generate();
    const { trees } = makeTree(w);
    const draft = buildFamilyTreeBundleDraft(w.identity, {
      trees,
      rootNodeId: null,
      sharerName: 'Legacy',
    });
    draft.claim.children = draft.claim.children.filter(
      (c) => !(c.node === 'leaf' && c.name === 'is_minimal'),
    );
    const signed = w.sign(draft);
    const view = readFamilyTreeBundle(signed, w.publicKey);
    expect(view.isMinimal).toBe(false);
    expect(view.projection).toBeNull();
    expect(view.trees.length).toBe(trees.length);
  });
});

describe('familyTreeBundle — defensive reader', () => {
  it('is not a bundle when credential_type does not match', () => {
    const w = Wallet.generate();
    const node = w.sign(buildPersonNodeDraft(w.identity, { displayName: 'X' }));
    expect(isFamilyTreeBundle(node)).toBe(false);
  });

  it('returns an empty trees array when trees_json is empty', () => {
    const w = Wallet.generate();
    const signed = w.sign(
      buildFamilyTreeBundleDraft(w.identity, {
        trees: [],
        rootNodeId: null,
        sharerName: '',
      }),
    );
    const view = readFamilyTreeBundle(signed, w.publicKey);
    expect(view.trees).toEqual([]);
    expect(view.sharerName).toBe('A friend'); // empty -> friendly default
  });

  it('drops non-attestation entries inside trees_json without throwing', () => {
    const w = Wallet.generate();
    const { trees } = makeTree(w);
    // Hand-craft a bundle whose trees_json mixes a valid attestation with junk.
    const tainted = JSON.stringify([trees[0], { not: 'an attestation' }, 42, null]);
    const signed = signedBundleWithTreesJson(w, tainted);
    const view = readFamilyTreeBundle(signed, w.publicKey);
    // Only the one valid attestation survives.
    expect(view.trees).toHaveLength(1);
    expect(envelopeId(view.trees[0]!)).toBe(envelopeId(trees[0]!));
  });

  it('survives outright-malformed trees_json (not even JSON)', () => {
    const w = Wallet.generate();
    const signed = signedBundleWithTreesJson(w, '{not json at all');
    expect(readFamilyTreeBundle(signed, w.publicKey).trees).toEqual([]);
  });
});

// Helper: produce a signed bundle whose trees_json leaf is set to an arbitrary
// string, so we can drive the defensive parser against junk payloads. Mutates
// the draft's leaf before signing (signatures cover the final bytes).
function signedBundleWithTreesJson(w: Wallet, treesJson: string): Attestation {
  const draft = buildFamilyTreeBundleDraft(w.identity, {
    trees: [],
    rootNodeId: null,
    sharerName: 'Tester',
  });
  for (const child of draft.claim.children) {
    if (child.node === 'leaf' && child.name === 'trees_json') {
      child.value = treesJson;
    }
  }
  return w.sign(draft);
}
