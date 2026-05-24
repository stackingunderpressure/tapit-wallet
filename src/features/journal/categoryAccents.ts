// Per-category accent colors for the Fresh Today list. Each
// category gets a distinct hue drawn from the Fresh palette so
// the list reads as colored stripes at a glance — Diary,
// Family, Medical, Marriage, Witness all map to existing Fresh
// tokens (lime, lavender, cyan, amber, coral), and any
// operator-typed category falls back to a hash-derived hue so
// custom labels still get a stable colour without manual mapping.
//
// The accent is exposed as a left-edge stripe (border-l-4) on
// each card plus the matching colour on the category badge.
// Pure CSS values (no Tailwind class strings) so the component
// can apply them inline — Tailwind's content scanner would not
// see hash-derived colours otherwise.

export interface CategoryAccent {
  /** Full hex colour for the left-edge stripe + category badge. */
  hex: string;
  /** rgba() string at low alpha for a subtle card-body tint. */
  tint: string;
}

const KNOWN_ACCENTS: Record<string, CategoryAccent> = {
  Diary: { hex: '#c0fc4d', tint: 'rgba(192, 252, 77, 0.10)' },
  Family: { hex: '#a78bfa', tint: 'rgba(167, 139, 250, 0.10)' },
  Medical: { hex: '#22d3ee', tint: 'rgba(34, 211, 238, 0.10)' },
  Marriage: { hex: '#f59e0b', tint: 'rgba(245, 158, 11, 0.10)' },
  Witness: { hex: '#f87171', tint: 'rgba(248, 113, 113, 0.10)' },
};

// Twelve hues evenly spaced around the colour wheel. Custom
// operator-typed categories hash into this palette so two
// operators with the same custom label see the same colour
// across devices, and the colour is stable across reloads.
const FALLBACK_HUES = [
  '#fde68a',
  '#fca5a5',
  '#fcd34d',
  '#86efac',
  '#7dd3fc',
  '#c4b5fd',
  '#f0abfc',
  '#fdba74',
  '#a3e635',
  '#67e8f9',
  '#fbb6ce',
  '#f9a8d4',
];

function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function hexToRgbaTint(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.10)`;
}

export function categoryAccent(category: string): CategoryAccent {
  const known = KNOWN_ACCENTS[category];
  if (known) return known;
  const hex =
    FALLBACK_HUES[fnv1a(category) % FALLBACK_HUES.length] ?? '#a1a1aa';
  return { hex, tint: hexToRgbaTint(hex) };
}

// Derive a single-line title from a journal entry's body text.
// Takes the first sentence (split on . ! ? followed by space or
// end-of-string) or the first 60 characters, whichever is
// shorter, trimmed. Used as the bold first line on each card
// so the list scans as a sequence of titled entries instead of
// uniformly-wrapped paragraphs.
//
// Returns an empty string when the entry has no text (a photo-
// only entry); the card surface handles the empty-title case
// by rendering the attachment label as the title instead.
export function deriveTitle(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return '';
  const sentenceMatch = trimmed.match(/^[^.!?\n]{1,80}(?=[.!?](\s|$)|\n|$)/);
  const candidate = sentenceMatch ? sentenceMatch[0] : trimmed;
  if (candidate.length <= 60) return candidate.trim();
  return candidate.slice(0, 57).trim() + '…';
}
