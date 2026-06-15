// Relationship-leaf options shared by the handshake chip picker and the
// label helper. Kept in its own (component-free) module so RelationshipChips
// can stay a pure component file — react-refresh only fast-refreshes files
// that export components alone.
//
// Wire values are lowercase so they stay stable across builds; display
// labels are capitalised for the operator's eyes. Empty string means the
// operator chose not to label the bond — the leaf is omitted from the
// attestation, which round-trips as relationship: '' on read. Immediate-
// family options surface first (spouse + child were operator-named
// must-haves; parent + sibling round out the immediate set); 'family' is
// the catch-all for extended relatives. Order matters — chips render in
// declaration order.

export const RELATIONSHIPS: { value: string; label: string }[] = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child' },
  { value: 'parent', label: 'Parent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'family', label: 'Family' },
  { value: 'friend', label: 'Friend' },
  { value: 'coworker', label: 'Coworker' },
  { value: 'acquaintance', label: 'Acquaintance' },
  { value: 'other', label: 'Other' },
];

/** Capitalised display form of a relationship wire value. */
export function relationshipLabel(value: string): string {
  return RELATIONSHIPS.find((r) => r.value === value)?.label ?? value;
}
