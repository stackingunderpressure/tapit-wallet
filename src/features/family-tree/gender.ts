import type { Sex } from './personNode.ts';

// Family-tree — gendered kin naming.
//
// kinGraph.relationshipLabel derives the NEUTRAL structural label between
// two people ("parent", "grandparent", "aunt/uncle", "sibling", …) from the
// stored parent_of / spouse edges alone. That neutral label is the right
// thing to teach from (kinEducation keys off it) and the right thing to
// store — but it is not how a family talks. genderKinLabel turns the neutral
// label into the word a person uses for THAT relative, using the relative's
// own recorded sex: mother / father, grandmother / grandfather, sister /
// brother, daughter / son, aunt / uncle, niece / nephew, wife / husband, and
// the -in-law forms.
//
// Pure and total: an unset sex, or a label with no gendered English form
// (cousins of any degree), returns the label unchanged. Great-/grand-
// prefixes are preserved, so "great-grand-aunt/uncle" genders to
// "great-grand-aunt" without re-deriving anything.

const DIRECT: Record<string, [string, string]> = {
  // label: [female, male]
  parent: ['mother', 'father'],
  child: ['daughter', 'son'],
  sibling: ['sister', 'brother'],
  spouse: ['wife', 'husband'],
  'sibling-in-law': ['sister-in-law', 'brother-in-law'],
  'parent-in-law': ['mother-in-law', 'father-in-law'],
  'child-in-law': ['daughter-in-law', 'son-in-law'],
};

/**
 * Gender a neutral kin label using the relative's sex. Returns the label
 * unchanged when sex is unset or the label has no gendered form.
 */
export function genderKinLabel(label: string, sex?: Sex): string {
  if (sex !== 'female' && sex !== 'male') return label;
  const i = sex === 'female' ? 0 : 1;

  const direct = DIRECT[label];
  if (direct) return direct[i];

  // Direct line, with any number of leading "great-".
  let m = /^((?:great-)*)grandparent$/.exec(label);
  if (m) return `${m[1]}grand${i === 0 ? 'mother' : 'father'}`;
  m = /^((?:great-)*)grandchild$/.exec(label);
  if (m) return `${m[1]}grand${i === 0 ? 'daughter' : 'son'}`;

  // Collateral, with optional "great-"* then optional "grand-".
  m = /^((?:great-)*(?:grand-)?)aunt\/uncle$/.exec(label);
  if (m) return `${m[1]}${i === 0 ? 'aunt' : 'uncle'}`;
  m = /^((?:great-)*(?:grand-)?)niece\/nephew$/.exec(label);
  if (m) return `${m[1]}${i === 0 ? 'niece' : 'nephew'}`;

  // "<base> by marriage" — gender the base, keep the suffix.
  m = /^(.*) by marriage$/.exec(label);
  if (m) return `${genderKinLabel(m[1] ?? '', sex)} by marriage`;

  // Cousins (any number / removed) and anything unrecognized have no
  // gendered English form — return as-is.
  return label;
}
