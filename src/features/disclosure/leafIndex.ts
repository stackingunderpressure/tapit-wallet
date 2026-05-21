import type { FieldBranch, FieldNode, FieldValue } from 'tapit-attest';

// Walk the claim tree and return every leaf reachable from the root,
// each with its slash-delimited path. Used by ShareProofModal to
// show the operator which leaves they can disclose.

export interface DisclosableLeaf {
  /** Slash-delimited path from the claim root to this leaf. */
  path: string;
  /** Leaf name (last segment of the path). */
  name: string;
  /** The leaf value as it would be disclosed. */
  value: FieldValue;
}

export function leafIndex(root: FieldBranch): DisclosableLeaf[] {
  const out: DisclosableLeaf[] = [];
  function walk(node: FieldNode, prefix: string[]): void {
    if (node.node === 'leaf') {
      out.push({
        path: prefix.concat(node.name).join('/'),
        name: node.name,
        value: node.value,
      });
      return;
    }
    for (const child of node.children) {
      walk(child, prefix.concat(node.name));
    }
  }
  // The root branch's own name is "claim" by convention; skip it in
  // the displayed path so leaves render as e.g. "text" rather than
  // "claim/text". Walk children directly.
  for (const child of root.children) {
    walk(child, []);
  }
  return out;
}
