// Family-tree kin education — turn a derived relationship label into a
// plain-English explanation of what that kinship term actually means
// (operator 2026-06-15: "educational info about kin — 3rd cousins, great
// uncle, cover every angle"). This is sovereignty literacy pointed at
// family: most people don't know WHY someone is a second cousin once
// removed, so the tree teaches it as you browse. Pure + matches the exact
// label shapes kinGraph.relationshipLabel produces.

function greatCount(label: string, anchor: string): number {
  // e.g. anchor 'grandparent' in 'great-great-grandparent' → 2 greats.
  const m = new RegExp(`^((?:great-)*)${anchor}$`).exec(label);
  if (!m) return -1;
  return ((m[1] ?? '').match(/great-/g) ?? []).length;
}

function ordinalWord(n: number): string {
  switch (n) {
    case 1:
      return 'a grandparent';
    case 2:
      return 'a great-grandparent';
    case 3:
      return 'a great-great-grandparent';
    default:
      return `an ancestor about ${n + 1} generations back`;
  }
}

/**
 * A warm, plain-English definition of a relationship label. Always returns
 * something — falls back to a generic line for an unrecognized label.
 */
export function explainRelationship(label: string): string {
  const l = label.trim();
  if (l === 'you') return 'This is you — the center of your tree.';
  if (l === 'spouse') return 'Your husband, wife, or partner.';
  if (l === 'sibling') return 'You share a parent.';
  if (l === 'parent') return 'Your mother or father.';
  if (l === 'child') return 'Your son or daughter.';

  // Direct ancestors: grandparent, great-grandparent, …
  const upGreats = greatCount(l, 'grandparent');
  if (upGreats >= 0) {
    const gens = upGreats + 2;
    return `A parent of your ${upGreats === 0 ? '' : 'great-'.repeat(upGreats)}grandparent — ${gens} generations up your direct line.`;
  }
  // Direct descendants: grandchild, great-grandchild, …
  const downGreats = greatCount(l, 'grandchild');
  if (downGreats >= 0) {
    const gens = downGreats + 2;
    return `A child of your ${downGreats === 0 ? '' : 'great-'.repeat(downGreats)}grandchild — ${gens} generations down your direct line.`;
  }

  // Aunt/uncle line (a sibling of an ancestor).
  if (l === 'aunt/uncle') return "A sibling of your parent.";
  const auGreats = greatCount(l, 'grand-aunt/uncle');
  if (auGreats >= 0) {
    const which = auGreats === 0 ? 'grandparent' : `${'great-'.repeat(auGreats)}grandparent`;
    return `A sibling of your ${which} — often called a ${auGreats === 0 ? 'great-' : 'great-'.repeat(auGreats + 1)}aunt or uncle.`;
  }
  // Niece/nephew line (a descendant of a sibling).
  if (l === 'niece/nephew') return "Your sibling's child.";
  const nnGreats = greatCount(l, 'grand-niece/nephew');
  if (nnGreats >= 0) {
    const which = nnGreats === 0 ? 'grandchild' : `${'great-'.repeat(nnGreats)}grandchild`;
    return `A ${which} of your sibling.`;
  }

  // Cousins: "Nth cousin" optionally "Mx removed".
  const cousin = /^(\d+)(?:st|nd|rd|th) cousin(?: (\d+)x removed)?$/.exec(l);
  if (cousin) {
    const n = Number(cousin[1]);
    const removed = cousin[2] ? Number(cousin[2]) : 0;
    let base = `You share ${ordinalWord(n)} — that closest common ancestor is what makes you cousins.`;
    if (removed > 0) {
      base += ` "${removed}x removed" means you're ${removed} generation${removed === 1 ? '' : 's'} apart, so one of you sits higher in the family line.`;
    }
    return base;
  }

  // Affinity / in-law.
  if (l === 'sibling-in-law') return "Your sibling's spouse, or your spouse's sibling.";
  if (l === 'parent-in-law') return "A parent of your spouse.";
  if (l === 'child-in-law') return "The spouse of your child.";
  if (l.endsWith(' by marriage')) {
    return 'Related to you through a marriage rather than by blood.';
  }

  return 'A relative of yours.';
}
