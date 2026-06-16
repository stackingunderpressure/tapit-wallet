import type { Attestation } from 'tapit-attest';
import { credentialAttestation, envelopeId } from 'tapit-attest';
import { leafValue } from '../connections/createHandshake.ts';
import { isPersonNode, readPersonNode } from '../family-tree/personNode.ts';
import { isKinEdge } from '../family-tree/kinEdge.ts';
import { isPersonEdit } from '../family-tree/personEdit.ts';

// Friends' trees — the CONSENTED family-tree SHARE bundle (slice 1).
//
// When a person taps "Share my family tree with {name}", the wallet packs
// ONLY their family-tree attestations — person-nodes, kin-edges, and
// append-only person-edits — into one credential-kind envelope and sends it
// over the existing encrypted Mycelium transport to that one recipient. The
// recipient's wallet recognizes it (isFamilyTreeBundle), reads it back, and
// persists it into the encrypted foreignTreesStore — NEVER into wallet.hold,
// NEVER mixed into their own holdings/graph. A friend's tree is shown
// strictly read-only, rooted on the sharer's own self person-node.
//
// PRIVACY RAILS encoded here:
//   - collectMyTreeAttestations filters EXPLICITLY by the three family-tree
//     predicates (person-node / kin-edge / person-edit). It NEVER ships the
//     whole holdings array, so secrets, journal entries, keys, handshakes,
//     family-units, etc. cannot ride along.
//   - person-nodes / kin-edges carry only PUBLIC signed claims (displayName,
//     dates, sex, public keyed_pubkey). No private key or mnemonic exists in
//     these attestations to leak — they are signed public claims by design.
//   - The trees array is stored as a single JSON-string leaf (same discipline
//     as any string scalar leaf), so the bundle is one ordinary signed
//     attestation that rides the existing sendEnvelopeTo path.
//
// The bundle is a CLAIM the sharer signs: "this is my family tree, as I hold
// it, shared with you now." The signing date is never forged; the envelope
// signer is the sharer's identity, which the receiver attributes as
// provenance.

const CREDENTIAL_TYPE = 'family-tree-bundle';

export interface FamilyTreeBundleInput {
  /** The sharer's family-tree attestations (nodes + edges + edits). */
  trees: readonly Attestation[];
  /**
   * The sharer's OWN self person-node id (envelopeId of the person-node keyed
   * to their identity). The receiver roots the read-only canvas on this so
   * the friend's tree is laid out from THEM. May be null if the sharer has no
   * keyed self-node yet — the receiver falls back to an unrooted layout.
   */
  rootNodeId: string | null;
  /** The sharer's display name, for the receiver's provenance banner. */
  sharerName: string;
}

export interface FamilyTreeBundleView {
  /** The envelope signer — the sharer's identity pubkey (provenance). */
  senderPubkey: string;
  trees: Attestation[];
  rootNodeId: string | null;
  sharerName: string;
  /** ISO 8601 — when the sharer signed this bundle (the share moment). */
  sharedAt: string;
}

/**
 * Build the unsigned draft for a family-tree bundle. Pure — the caller signs
 * it with wallet.sign and ships it with sendEnvelopeTo. Mirrors the
 * buildSecretPieceEnvelope discipline (credentialAttestation + a JSON leaf)
 * but stays a pure DRAFT builder so it is trivially unit-testable; the signing
 * + sending live in the ShareTreeModal caller.
 *
 * The trees array is serialized to a JSON-string leaf. sharedAt is recorded
 * now (the honest share moment) and re-read by the receiver for provenance.
 */
export function buildFamilyTreeBundleDraft(
  authorIdentity: string,
  input: FamilyTreeBundleInput,
): Attestation {
  return credentialAttestation({
    subject: authorIdentity,
    tier: 'notable',
    fields: {
      credential_type: CREDENTIAL_TYPE,
      sharer_name: input.sharerName.trim(),
      root_node_id: input.rootNodeId ?? '',
      shared_at: new Date().toISOString(),
      // The whole family-tree attestation set, as canonical JSON. A leaf
      // value is a string scalar; the receiver re-parses it defensively.
      trees_json: JSON.stringify(input.trees),
    },
  });
}

/** True when an attestation is a family-tree bundle. */
export function isFamilyTreeBundle(att: Attestation): boolean {
  return (
    att.kind === 'credential' &&
    leafValue(att, 'credential_type') === CREDENTIAL_TYPE
  );
}

/**
 * Read a family-tree bundle into a plain view, DEFENSIVELY. A malformed
 * trees_json, a non-array payload, or junk entries never throw — the parser
 * returns whatever well-formed attestation-shaped entries it can recover and
 * drops the rest, so a corrupt or hostile bundle degrades to an empty/partial
 * tree rather than crashing the inbox handler.
 *
 * senderPubkey is supplied by the caller (the envelope signer recovered by the
 * transport), NOT trusted from inside the bundle — the bundle's own subject is
 * advisory only. This keeps provenance honest: the receiver attributes the
 * tree to whoever actually signed the envelope.
 */
export function readFamilyTreeBundle(
  att: Attestation,
  senderPubkey: string,
): FamilyTreeBundleView {
  const rootRaw = leafValue(att, 'root_node_id');
  return {
    senderPubkey,
    trees: parseTreesJson(leafValue(att, 'trees_json')),
    rootNodeId: rootRaw.trim().length > 0 ? rootRaw : null,
    sharerName: leafValue(att, 'sharer_name') || 'A friend',
    sharedAt: leafValue(att, 'shared_at') || att.issuedAt,
  };
}

/** Recover an array of attestation-shaped entries from a JSON string. Any
 *  failure or non-array yields []; individual non-object entries are dropped. */
function parseTreesJson(raw: string): Attestation[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: Attestation[] = [];
  for (const entry of parsed) {
    if (looksLikeAttestation(entry)) out.push(entry as Attestation);
  }
  return out;
}

/** Minimal structural shape-check — enough to feed buildKinGraph safely. We do
 *  NOT verify signatures here; the read-only friend view never trusts these
 *  for any action (no merge, no hold, no sign), so a permissive shape check is
 *  the right posture: render what parses, ignore what does not. */
function looksLikeAttestation(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.kind === 'string' &&
    typeof v.subject === 'string' &&
    typeof v.claim === 'object' &&
    v.claim !== null &&
    Array.isArray(v.signatures)
  );
}

/**
 * Collect the attestations to SHARE from the operator's holdings. Filters
 * EXPLICITLY to the three family-tree predicates — person-node, kin-edge,
 * person-edit — so nothing else (secrets, journal moments, keys, handshakes,
 * identity, family-units) can ever ride along in a shared bundle. This is the
 * privacy-rail #3 enforcement point.
 *
 * `_myIdentity` is accepted for symmetry with the rest of the family-tree API
 * (every builder/finder here takes the operator identity) and to keep the call
 * site honest about whose tree is being collected; the filter itself is
 * content-based — the tree is whatever family-tree attestations the wallet
 * holds — so the identity is not used to widen the set. Underscore-prefixed so
 * the strict no-unused-parameters rule accepts the reserved argument.
 */
export function collectMyTreeAttestations(
  holdings: readonly Attestation[],
  _myIdentity: string,
): Attestation[] {
  return holdings.filter(
    (att) => isPersonNode(att) || isKinEdge(att) || isPersonEdit(att),
  );
}

/**
 * Find the operator's OWN self person-node id within their holdings — the
 * person-node whose keyed_pubkey equals their identity. Returns its envelopeId
 * (the graph node id the canvas roots on) or null when the operator has not
 * yet keyed a self-node. Mirrors FamilyTreeEditor's selfId derivation but over
 * raw holdings rather than a built graph, so it can run before send.
 */
export function findMyRootNodeId(
  holdings: readonly Attestation[],
  myIdentity: string,
): string | null {
  const lc = myIdentity.toLowerCase();
  for (const att of holdings) {
    if (!isPersonNode(att)) continue;
    const view = readPersonNode(att);
    if (view.keyedPubkey?.toLowerCase() === lc) return envelopeId(att);
  }
  return null;
}
