import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'family-tree',
  born: '2026-06-14',
  purpose:
    'The sovereign family tree (CUT 1 foundation — the pure graph core). A family member is a PERSON NODE; most ancestors hold no wallet and are WITNESSED in by the living (keyless), while living members can be keyed to their own wallet. The tree is built from one primitive blood edge (parent_of) plus a spouse edge for affinity; every other relationship — grandparent, great^N-grandparent, sibling, aunt/uncle, niece/nephew, cousin Nth-removed, in-law / by-marriage — is DERIVED by walking the graph (relationshipLabel), which is the engine behind "it can name that it is third cousins." This first cut ships data substrate only: pure draft builders (buildPersonNodeDraft / buildParentEdgeDraft / buildSpouseEdgeDraft following the buildHandshakeDraft discipline), predicates + readers (isPersonNode / readPersonNode / isKinEdge / readKinEdge), and the pure graph reader + namer (buildKinGraph / relationshipLabel). No UI, no signing-pipeline wiring, no network yet — those follow in later slices, then the handshake-merge cut.',
  touches: [
    'src/features/family-tree/personNode.ts',
    'src/features/family-tree/personNode.test.ts',
    'src/features/family-tree/kinEdge.ts',
    'src/features/family-tree/kinEdge.test.ts',
    'src/features/family-tree/kinGraph.ts',
    'src/features/family-tree/kinGraph.test.ts',
  ],
  depends_on: ['wallet-core'],
  pause_safe: true,
  removal_safe: true,
  monetizable: false,
  notes:
    'Spec: briefs/2026-06-14-editable-family-tree-and-handshake-merge-spec.md. Honesty boundary (same as the journal Moments cut): born/died are CLAIMS recorded now; the signing date is never forged, and keyed_pubkey is set ONLY when the person genuinely has a wallet (never invented; a keyless child node becomes keyed via the custody-handoff pattern when they get their own wallet). A person-node is a credential-kind attestation (credential_type=person_node); a kin edge is a relationship-kind attestation (kin_relation=parent_of|spouse, kin_from/kin_to referencing person-node envelopeIds). The node id is envelopeId(signedAnchor) — the same content-address every other feature uses. Nodes + edges are family-co-signable later so the canonical node accretes weight; the merge cut (CUT 3) binds duplicate nodes across two relatives\' trees, anchored on the shared keyed person and human-confirmed (never silent auto-merge on name). relationshipLabel handles consanguinity via most-recent-common-ancestor (cousin number = min(depths)-1, removed = |depth difference|) and one-hop affinity (spouse of a blood relative, or a blood relative of one\'s spouse); deeper affinity chains are a follow-on. Pure + fully unit-tested; pause_safe and removal_safe because nothing yet imports it (substrate only). depends_on wallet-core for the tapit-attest builders/types. Follow-on slices: the edit-your-adjacent-layer editor UI, PeopleTree ancestor-ring rendering (peopleTreeLayout already anticipates a family-node branch), the sign/hold/anchor wiring, then CUT 3 handshake-merge + CUT 4 memory reconciliation.',
};
