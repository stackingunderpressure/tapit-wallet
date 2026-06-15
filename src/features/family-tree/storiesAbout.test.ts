import { describe, it, expect } from 'vitest';
import type { Attestation } from 'tapit-attest';
import { isStoryAbout, storiesAbout } from './storiesAbout.ts';
import type { KinNode } from './kinGraph.ts';

function journal(
  subject: string,
  eventDate?: string,
  issuedAt = '2026-01-01T00:00:00.000Z',
  subjectNode?: string,
): Attestation {
  const children: { node: 'leaf'; name: string; value: string }[] = [];
  if (eventDate) children.push({ node: 'leaf', name: 'event_date', value: eventDate });
  if (subjectNode)
    children.push({ node: 'leaf', name: 'subject_node', value: subjectNode });
  return {
    kind: 'journal',
    subject,
    issuedAt,
    claim: { node: 'branch', name: 'claim', children },
  } as unknown as Attestation;
}

const pam: KinNode = { id: 'n1', displayName: 'Pam Winchester', keyed: false };
const sister: KinNode = {
  id: 'n2',
  displayName: 'Sister',
  keyed: true,
  keyedPubkey: 'a'.repeat(64),
};

describe('isStoryAbout', () => {
  it('matches a keyless person by display name (case-insensitive)', () => {
    expect(isStoryAbout(journal('pam winchester'), pam)).toBe(true);
  });
  it('matches a keyed person by pubkey', () => {
    expect(isStoryAbout(journal('A'.repeat(64)), sister)).toBe(true);
  });
  it('does not match a different subject', () => {
    expect(isStoryAbout(journal('someone else'), pam)).toBe(false);
  });
  it('ignores non-journal attestations', () => {
    const cred = { ...journal('Pam Winchester'), kind: 'credential' } as Attestation;
    expect(isStoryAbout(cred, pam)).toBe(false);
  });
  it('matches by subject_node id even when the name differs', () => {
    const e = journal('wrong name', undefined, undefined, pam.id);
    expect(isStoryAbout(e, pam)).toBe(true);
  });
  it('a subject_node binding to a DIFFERENT node excludes it (name ignored)', () => {
    // subject name would match by the legacy path, but the explicit
    // node link points elsewhere, so the robust link wins.
    const e = journal('Pam Winchester', undefined, undefined, 'other-node');
    expect(isStoryAbout(e, pam)).toBe(false);
  });
  it('matches a subject_node that is an ALIAS id of a merged node', () => {
    // After a same_as merge the canonical node carries alias ids; a story
    // bound to a pre-merge id must still match.
    const merged: KinNode = {
      id: 'canonical',
      displayName: 'Pam Winchester',
      keyed: false,
      aliasIds: ['canonical', 'premerge-id'],
    };
    const e = journal('whatever', undefined, undefined, 'premerge-id');
    expect(isStoryAbout(e, merged)).toBe(true);
  });
});

describe('storiesAbout', () => {
  it('returns matching stories newest-moment-first', () => {
    const holdings = [
      journal('Pam Winchester', '2009-04-12'),
      journal('Pam Winchester', '1978-01-01'),
      journal('someone else', '2020-01-01'),
    ];
    const out = storiesAbout(holdings, pam);
    expect(out).toHaveLength(2);
    // 2009 is more recent than 1978 → first
    expect(out[0]?.subject).toBe('Pam Winchester');
    expect(out.map((a) => a.claim)).not.toContainEqual(
      expect.objectContaining({ subject: 'someone else' }),
    );
  });
});
