import type { Attestation, FieldBranch } from 'tapit-attest';

// Diary tags — multi-label your everyday entries (food, places, friends,
// things, pictures…) and pull them back up by tag. Tags are separate from
// the single `category` tab: an entry has one category but any number of
// tags. Stored as a signed `tags` leaf (canonical JSON array) so the
// labels are tamper-evident like everything else. Pure helpers; no I/O.

// The everyday-life tags the composer suggests. Multi-select, and a custom
// tag can always be typed in. These are the categories people actually live
// by — kept broad so most days fit without inventing one.
export const SUGGESTED_TAGS = [
  'Food',
  'Places',
  'Friends',
  'Family',
  'Things',
  'Pictures',
  'Travel',
  'Work',
  'Health',
  'Pets',
  'Nature',
  'Fun',
  'Faith',
  'Money',
  'Learning',
  'Milestone',
] as const;

function leafValue(att: Attestation, name: string): string {
  const claim = att.claim as FieldBranch;
  const node = claim.children.find((c) => c.name === name);
  return node && node.node === 'leaf' && typeof node.value === 'string'
    ? node.value
    : '';
}

/** Trim + collapse internal whitespace; preserves the author's casing. */
export function normalizeTag(tag: string): string {
  return tag.trim().replace(/\s+/g, ' ');
}

/** Dedupe a tag list case-insensitively, keeping first-seen casing and order. */
export function dedupeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const n = normalizeTag(t);
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

/** Read an entry's tags (the `tags` leaf), or [] when absent/malformed. */
export function readTags(att: Attestation): string[] {
  const raw = leafValue(att, 'tags');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

/** True when an entry carries `tag` (case-insensitive). */
export function hasTag(att: Attestation, tag: string): boolean {
  const want = normalizeTag(tag).toLowerCase();
  return readTags(att).some((t) => normalizeTag(t).toLowerCase() === want);
}

/**
 * Every tag present across entries, with how many entries carry it,
 * sorted most-used first then alphabetically. Drives the filter bar.
 */
export function allTags(
  entries: readonly Attestation[],
): { tag: string; count: number }[] {
  const counts = new Map<string, { tag: string; count: number }>();
  for (const e of entries) {
    for (const t of readTags(e)) {
      const n = normalizeTag(t);
      if (!n) continue;
      const key = n.toLowerCase();
      const cur = counts.get(key);
      if (cur) cur.count += 1;
      else counts.set(key, { tag: n, count: 1 });
    }
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.tag.localeCompare(b.tag),
  );
}

/**
 * Entries that carry ALL of the selected tags (AND filter — narrowing as
 * you add tags). Empty selection returns everything.
 */
export function entriesWithTags(
  entries: readonly Attestation[],
  tags: readonly string[],
): Attestation[] {
  const wanted = dedupeTags(tags).map((t) => t.toLowerCase());
  if (wanted.length === 0) return [...entries];
  return entries.filter((e) => {
    const have = readTags(e).map((t) => normalizeTag(t).toLowerCase());
    return wanted.every((w) => have.includes(w));
  });
}
