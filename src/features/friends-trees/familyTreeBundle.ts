import type { Attestation } from 'tapit-attest';
import { credentialAttestation, envelopeId } from 'tapit-attest';
import { leafValue } from '../connections/createHandshake.ts';
import { isPersonNode, readPersonNode } from '../family-tree/personNode.ts';
import { isKinEdge } from '../family-tree/kinEdge.ts';
import { isPersonEdit } from '../family-tree/personEdit.ts';
import type { MinimalTreeProjection } from './familyTreeProjection.ts';

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
// MINIMAL-SHARE PRIVACY SLICE (2026-06-16) — minimal is the DEFAULT:
//   - A bundle is built in one of two modes. FULL mode carries the complete
//     attestation set (trees_json), unchanged from slice 1. MINIMAL mode
//     carries ONLY a redacted projection (projection_json, is_minimal='true'):
//     each person's FIRST NAME + the tree STRUCTURE (parent_of / spouse) +
//     the single shared-anchor keyedPubkey. It carries NO surname, NO born,
//     NO died, NO sex, and NO keyedPubkey other than the shared anchor's.
//   - Redaction happens at BUILD TIME on the sender (see familyTreeProjection
//     .buildMinimalProjection). The sensitive fields are stripped BEFORE the
//     bundle is signed, so they never cross the wire — there is no
//     "trust the recipient to hide it" anywhere in this path.
//   - readFamilyTreeBundle detects the variant: minimal bundles return a
//     pre-built KinGraph reconstructed directly from the projection (no fake
//     signed attestations); full bundles keep returning parsed trees.
//     Existing/received FULL bundles still render — backward compatible.
//
// The bundle is a CLAIM the sharer signs: "this is my family tree, as I hold
// it, shared with you now." The signing date is never forged; the envelope
// signer is the sharer's identity, which the receiver attributes as
// provenance.

const CREDENTIAL_TYPE = 'family-tree-bundle';

export interface FamilyTreeBundleInput {
  /**
   * FULL mode: the sharer's family-tree attestations (nodes + edges + edits).
   * Provide this OR `projection`, never both. When `projection` is set the
   * bundle is built in minimal mode and `trees` is ignored.
   */
  trees?: readonly Attestation[];
  /**
   * MINIMAL mode (the DEFAULT share): the redacted projection — first names +
   * structure + the single shared-anchor keyedPubkey only. When set, the
   * bundle carries projection_json + is_minimal='true' and NO full
   * attestations. Redaction already happened (build-time, on the sender).
   */
  projection?: MinimalTreeProjection;
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
  /**
   * Full-mode attestations, parsed defensively. Empty for a minimal bundle
   * (a minimal bundle carries no attestations — only the projection).
   */
  trees: Attestation[];
  /**
   * Minimal-mode projection, or null for a full bundle. When present the view
   * is a minimal share and the receiver renders from `projection` directly
   * (kinGraphFromProjection) rather than from `trees`.
   */
  projection: MinimalTreeProjection | null;
  /** True for a minimal (redacted) bundle, false for a full one. */
  isMinimal: boolean;
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
  const base = {
    credential_type: CREDENTIAL_TYPE,
    sharer_name: input.sharerName.trim(),
    root_node_id: input.rootNodeId ?? '',
    shared_at: new Date().toISOString(),
  };

  // MINIMAL mode — carry ONLY the redacted projection. The full attestations
  // (and therefore surnames, dates, sex, and every non-anchor keyedPubkey)
  // are NEVER serialized into this envelope. is_minimal='true' marks the
  // variant; trees_json is empty so the defensive full reader yields [].
  if (input.projection) {
    return credentialAttestation({
      subject: authorIdentity,
      tier: 'notable',
      fields: {
        ...base,
        is_minimal: 'true',
        projection_json: JSON.stringify(input.projection),
        trees_json: '',
      },
    });
  }

  // FULL mode (opt-in) — the whole family-tree attestation set, unchanged.
  return credentialAttestation({
    subject: authorIdentity,
    tier: 'notable',
    fields: {
      ...base,
      is_minimal: 'false',
      // The whole family-tree attestation set, as canonical JSON. A leaf
      // value is a string scalar; the receiver re-parses it defensively.
      trees_json: JSON.stringify(input.trees ?? []),
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
  // Minimal iff explicitly flagged AND the projection actually parses. A
  // missing is_minimal leaf (old full bundles) reads '' -> full path, so
  // backward compatibility is automatic.
  const projection =
    leafValue(att, 'is_minimal') === 'true'
      ? parseProjectionJson(leafValue(att, 'projection_json'))
      : null;
  return {
    senderPubkey,
    // A minimal bundle carries no attestations; a full bundle carries them.
    trees: projection ? [] : parseTreesJson(leafValue(att, 'trees_json')),
    projection,
    isMinimal: projection !== null,
    rootNodeId: rootRaw.trim().length > 0 ? rootRaw : null,
    sharerName: leafValue(att, 'sharer_name') || 'A friend',
    sharedAt: leafValue(att, 'shared_at') || att.issuedAt,
  };
}

/**
 * Recover a MinimalTreeProjection from a JSON string, DEFENSIVELY. Any parse
 * failure, non-object, or structurally-wrong payload yields null so the
 * caller falls back to the full-attestation path (or renders empty) rather
 * than crashing. Individual junk nodes/edges are dropped; the projection
 * carries only string ids, first names, and the known relations.
 */
function parseProjectionJson(raw: string): MinimalTreeProjection | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const p = parsed as Record<string, unknown>;
  if (!Array.isArray(p.nodes) || !Array.isArray(p.edges)) return null;

  const nodes = p.nodes
    .filter(
      (n): n is { id: string; firstName: string } =>
        typeof n === 'object' &&
        n !== null &&
        typeof (n as Record<string, unknown>).id === 'string' &&
        typeof (n as Record<string, unknown>).firstName === 'string',
    )
    .map((n) => ({ id: n.id, firstName: n.firstName }));

  const edges = p.edges
    .filter((e): e is { relation: string; from: string; to: string } => {
      if (typeof e !== 'object' || e === null) return false;
      const r = e as Record<string, unknown>;
      return (
        (r.relation === 'parent_of' ||
          r.relation === 'spouse' ||
          r.relation === 'same_as') &&
        typeof r.from === 'string' &&
        typeof r.to === 'string'
      );
    })
    .map((e) => ({
      relation: e.relation as 'parent_of' | 'spouse' | 'same_as',
      from: e.from,
      to: e.to,
    }));

  const anchorNodeId =
    typeof p.anchorNodeId === 'string' ? p.anchorNodeId : null;
  const anchorPubkey =
    typeof p.anchorPubkey === 'string' ? p.anchorPubkey : null;

  return { nodes, edges, anchorNodeId, anchorPubkey };
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
