import { describe, it, expect } from 'vitest';
import type { Attestation } from 'tapit-attest';
import {
  normalizeTag,
  dedupeTags,
  readTags,
  hasTag,
  allTags,
  entriesWithTags,
} from './journalTags.ts';

function entry(tags?: string[]): Attestation {
  const children: { node: 'leaf'; name: string; value: string }[] = [
    { node: 'leaf', name: 'text', value: 'x' },
  ];
  if (tags) children.push({ node: 'leaf', name: 'tags', value: JSON.stringify(tags) });
  return {
    kind: 'journal',
    subject: 'me',
    issuedAt: '2026-01-01T00:00:00.000Z',
    claim: { node: 'branch', name: 'claim', children },
  } as unknown as Attestation;
}

describe('normalizeTag / dedupeTags', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeTag('  road   trip ')).toBe('road trip');
  });
  it('dedupes case-insensitively, keeps first casing + order', () => {
    expect(dedupeTags(['Food', 'food', 'Places', ' '])).toEqual([
      'Food',
      'Places',
    ]);
  });
});

describe('readTags / hasTag', () => {
  it('reads the tags leaf', () => {
    expect(readTags(entry(['Food', 'Places']))).toEqual(['Food', 'Places']);
  });
  it('returns [] when no tags leaf', () => {
    expect(readTags(entry())).toEqual([]);
  });
  it('hasTag is case-insensitive', () => {
    expect(hasTag(entry(['Food']), 'food')).toBe(true);
    expect(hasTag(entry(['Food']), 'Places')).toBe(false);
  });
});

describe('allTags', () => {
  it('counts across entries, most-used first', () => {
    const list = allTags([
      entry(['Food', 'Friends']),
      entry(['Food']),
      entry(['Places']),
    ]);
    expect(list[0]).toEqual({ tag: 'Food', count: 2 });
    expect(list.map((x) => x.tag)).toContain('Friends');
    expect(list.map((x) => x.tag)).toContain('Places');
  });
});

describe('entriesWithTags (AND filter)', () => {
  const a = entry(['Food', 'Friends']);
  const b = entry(['Food']);
  const c = entry(['Places']);
  it('empty selection returns all', () => {
    expect(entriesWithTags([a, b, c], [])).toHaveLength(3);
  });
  it('single tag filters', () => {
    expect(entriesWithTags([a, b, c], ['Food'])).toEqual([a, b]);
  });
  it('multiple tags narrow (AND)', () => {
    expect(entriesWithTags([a, b, c], ['Food', 'Friends'])).toEqual([a]);
  });
  it('is case-insensitive', () => {
    expect(entriesWithTags([a, b, c], ['food'])).toEqual([a, b]);
  });
});
