import { describe, it, expect } from 'vitest';
import { promoteToJournalPrefill } from './promoteToJournalPrefill.ts';
import type { PromotePayload } from './promoteTarget.ts';

// promoteToJournalPrefill maps a promote-to-envelope payload from
// PeerThread into the shape JournalComposer.prefill accepts. The
// load-bearing behavior is the relationship-aware category
// pre-selection: family-classified relationships (spouse, child,
// parent, sibling, family) pre-pick the Family journal category;
// everything else leaves the category undefined so the composer
// falls back to its own default.

function makePayload(over: Partial<PromotePayload> = {}): PromotePayload {
  return {
    target: 'journal',
    sourceText: 'thanks for the meal tonight',
    peerPubkey: 'a'.repeat(64),
    peerName: 'Bree',
    relationship: '',
    ...over,
  };
}

describe('promoteToJournalPrefill (messaging sub-cut 2c)', () => {
  it('passes the source text through verbatim as the body', () => {
    const out = promoteToJournalPrefill(makePayload({
      sourceText: 'I love you',
    }));
    expect(out.text).toBe('I love you');
  });

  it('passes the peer name through as the subject label', () => {
    const out = promoteToJournalPrefill(makePayload({
      peerName: 'Alice',
    }));
    expect(out.subjectLabel).toBe('Alice');
  });

  it.each([
    ['spouse'],
    ['child'],
    ['parent'],
    ['sibling'],
    ['family'],
  ])('pre-picks the Family category for relationship=%s', (rel) => {
    const out = promoteToJournalPrefill(makePayload({ relationship: rel }));
    expect(out.category).toBe('Family');
  });

  it.each([
    ['friend'],
    ['coworker'],
    ['acquaintance'],
    ['other'],
    [''],
  ])('leaves the category undefined for non-family relationship=%s', (rel) => {
    const out = promoteToJournalPrefill(makePayload({ relationship: rel }));
    expect(out.category).toBeUndefined();
  });

  it('preserves an empty source-text body if the operator promotes a blank moment', () => {
    const out = promoteToJournalPrefill(makePayload({ sourceText: '' }));
    expect(out.text).toBe('');
  });
});
