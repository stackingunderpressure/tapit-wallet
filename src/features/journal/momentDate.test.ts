import { describe, it, expect } from 'vitest';
import type { Attestation } from 'tapit-attest';
import {
  readEventDate,
  readWrittenAt,
  momentTimestamp,
  isBackfilled,
  normalizeEventDateInput,
  formatEventDate,
} from './momentDate.ts';
import { findMemoryEntries } from './findMemoryEntries.ts';

// Minimal attestation stand-in — the helpers only read claim.children
// (leaves) and issuedAt.
function entry(
  fields: Record<string, string>,
  issuedAt = '2026-01-01T00:00:00.000Z',
): Attestation {
  return {
    claim: {
      node: 'branch',
      name: 'claim',
      children: Object.entries(fields).map(([name, value]) => ({
        node: 'leaf',
        name,
        value,
      })),
    },
    issuedAt,
  } as unknown as Attestation;
}

const DAY = 24 * 60 * 60 * 1000;

describe('readEventDate', () => {
  it('returns the event_date leaf when present and parseable', () => {
    expect(readEventDate(entry({ event_date: '2009-06-15' }))).toBe(
      '2009-06-15',
    );
  });
  it('returns undefined when absent', () => {
    expect(readEventDate(entry({ text: 'hi' }))).toBeUndefined();
  });
  it('returns undefined when unparseable', () => {
    expect(readEventDate(entry({ event_date: 'not-a-date' }))).toBeUndefined();
  });
});

describe('readWrittenAt', () => {
  it('prefers the written_at leaf', () => {
    const e = entry({ written_at: '2026-03-01T12:00:00.000Z' });
    expect(readWrittenAt(e)).toBe(Date.parse('2026-03-01T12:00:00.000Z'));
  });
  it('falls back to issuedAt', () => {
    const e = entry({ text: 'x' }, '2026-02-02T00:00:00.000Z');
    expect(readWrittenAt(e)).toBe(Date.parse('2026-02-02T00:00:00.000Z'));
  });
});

describe('momentTimestamp', () => {
  it('uses event_date when present (the day it happened)', () => {
    const e = entry({
      event_date: '2009-06-15',
      written_at: '2026-03-01T00:00:00.000Z',
    });
    expect(momentTimestamp(e)).toBe(Date.parse('2009-06-15'));
  });
  it('falls back to written_at when no event_date', () => {
    const e = entry({ written_at: '2026-03-01T00:00:00.000Z' });
    expect(momentTimestamp(e)).toBe(Date.parse('2026-03-01T00:00:00.000Z'));
  });
});

describe('isBackfilled', () => {
  it('is true when the event predates the logging by more than a day', () => {
    const e = entry({
      event_date: '2009-06-15',
      written_at: '2026-03-01T00:00:00.000Z',
    });
    expect(isBackfilled(e)).toBe(true);
  });
  it('is false when there is no event_date', () => {
    expect(isBackfilled(entry({ written_at: '2026-03-01T00:00:00.000Z' }))).toBe(
      false,
    );
  });
  it('is false when the event is the same day it was logged', () => {
    const e = entry({
      event_date: '2026-03-01',
      written_at: '2026-03-01T18:00:00.000Z',
    });
    expect(isBackfilled(e)).toBe(false);
  });
});

describe('normalizeEventDateInput', () => {
  const now = Date.parse('2026-06-14T00:00:00.000Z');
  it('returns undefined for empty input', () => {
    expect(normalizeEventDateInput('   ', now)).toBeUndefined();
  });
  it('returns undefined for invalid input', () => {
    expect(normalizeEventDateInput('nope', now)).toBeUndefined();
  });
  it('rejects future dates', () => {
    expect(normalizeEventDateInput('2030-01-01', now)).toBeUndefined();
  });
  it('accepts a valid past date', () => {
    expect(normalizeEventDateInput('2009-06-15', now)).toBe('2009-06-15');
  });
});

describe('formatEventDate', () => {
  it('renders a date-only string without an off-by-one shift', () => {
    // Must contain the right calendar day regardless of local TZ.
    expect(formatEventDate('2009-06-15')).toContain('15');
    expect(formatEventDate('2009-06-15')).toContain('2009');
  });
  it('returns the raw string when unparseable', () => {
    expect(formatEventDate('garbage')).toBe('garbage');
  });
});

describe('findMemoryEntries with event_date', () => {
  it('resurfaces a backfilled memory on the day it HAPPENED', () => {
    const now = Date.parse('2026-06-15T12:00:00.000Z');
    // Event happened exactly 365 days before now; logged recently.
    const happened = new Date(now - 365 * DAY).toISOString().slice(0, 10);
    const e = entry({
      event_date: happened,
      written_at: '2026-06-10T00:00:00.000Z',
    });
    const hits = findMemoryEntries([e], now);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.daysAgo).toBe(365);
  });
  it('still matches plain entries on written_at when no event_date', () => {
    const now = Date.parse('2026-06-15T12:00:00.000Z');
    const writtenAt = new Date(now - 7 * DAY).toISOString();
    const e = entry({ written_at: writtenAt });
    const hits = findMemoryEntries([e], now);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.daysAgo).toBe(7);
  });
});
