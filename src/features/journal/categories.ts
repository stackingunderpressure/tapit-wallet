// Suggested categories the composer offers by default. The user
// can type any label and it becomes a tab. The protocol-level kind
// stays journal regardless; the category is a leaf in the field
// tree, so it is signed-into the attestation and tamper-evident.

export const SUGGESTED_CATEGORIES = [
  'Diary',
  'Family',
  'Medical',
  'Marriage',
  'Witness',
] as const;

export type SuggestedCategory = (typeof SUGGESTED_CATEGORIES)[number];
