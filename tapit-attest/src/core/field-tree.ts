import type { FieldBranch, FieldLeaf, FieldNode, FieldValue } from '../types.js';
import { canonicalJson, concatBytes, taggedHash, utf8ToBytes } from '../internal.js';

export function leaf(name: string, value: FieldValue): FieldLeaf {
  return { node: 'leaf', name, value };
}

export function branch(name: string, children: FieldNode[]): FieldBranch {
  return { node: 'branch', name, children };
}

/**
 * Build a field tree from a plain object. Nested objects become branches,
 * scalars become leaves, arrays are stored as canonical JSON in a leaf.
 * Keys are sorted at every depth so the same object always yields the
 * same tree — and therefore the same Merkle root.
 */
export function treeFromObject(name: string, obj: Record<string, unknown>): FieldBranch {
  const children: FieldNode[] = [];
  for (const key of Object.keys(obj).sort()) {
    const value = obj[key];
    if (Array.isArray(value)) {
      children.push(leaf(key, canonicalJson(value)));
    } else if (value !== null && typeof value === 'object') {
      children.push(treeFromObject(key, value as Record<string, unknown>));
    } else if (value === null || value === undefined) {
      children.push(leaf(key, ''));
    } else {
      children.push(leaf(key, value as FieldValue));
    }
  }
  return branch(name, children);
}

function leafHash(node: FieldLeaf): Uint8Array {
  return taggedHash(
    'tapit/leaf',
    utf8ToBytes(canonicalJson({ name: node.name, value: node.value })),
  );
}

function branchHash(node: FieldBranch): Uint8Array {
  const childHashes = node.children.map(nodeHash);
  return taggedHash('tapit/branch', utf8ToBytes(node.name), concatBytes(...childHashes));
}

function nodeHash(node: FieldNode): Uint8Array {
  return node.node === 'leaf' ? leafHash(node) : branchHash(node);
}

/**
 * The Merkle root of a field tree. Every signer signs a digest that
 * commits to this root, so changing any field — name or value, at any
 * depth — invalidates every signature.
 */
export function fieldTreeRoot(root: FieldBranch): Uint8Array {
  return branchHash(root);
}

/**
 * Resolve a leaf value by path. Path is slash-delimited (`fields/label`)
 * or an array of segment names. Returns undefined if the path misses or
 * lands on a branch.
 */
export function findLeafValue(
  root: FieldBranch,
  path: string | string[],
): FieldValue | undefined {
  const segments = Array.isArray(path) ? path : path.split('/').filter(Boolean);
  let current: FieldNode = root;
  for (const segment of segments) {
    if (current.node !== 'branch') return undefined;
    const next: FieldNode | undefined = current.children.find((c) => c.name === segment);
    if (!next) return undefined;
    current = next;
  }
  return current.node === 'leaf' ? current.value : undefined;
}

/**
 * v1.1 SLOT — field-level selective disclosure. The Merkle field tree
 * exists in v1 precisely so a subtree can later be revealed with its
 * sibling hashes and verified against the signed root, without exposing
 * the rest of the claim. Not implemented in v1.
 */
export function disclosureProof(): never {
  throw new Error('disclosureProof is a v1.1 slot — not implemented in v1');
}
