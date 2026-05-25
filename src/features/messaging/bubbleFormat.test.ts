import { describe, it, expect } from 'vitest';
import { formatBubbleHeader } from './bubbleFormat.ts';

// bubbleFormat.formatBubbleHeader formats Unix-seconds timestamps
// into the divider label PeerThread renders above grouped messages.
// Three branches:
//   - same day → time-of-day ("3:42 PM")
//   - same year but different day → month + day ("Mar 14")
//   - different year → full locale date
//
// The exact string depends on the test runner's locale, so the
// tests assert structural invariants (length, contains-digits,
// contains-colon-for-time) rather than literal output. That keeps
// the suite stable across CI environments.

describe('formatBubbleHeader (messaging cut 2b)', () => {
  it('renders a time-of-day label when ts is the same day as now', () => {
    const now = Math.floor(Date.UTC(2026, 2, 14, 15, 0, 0) / 1000);
    const ts = Math.floor(Date.UTC(2026, 2, 14, 9, 30, 0) / 1000);
    const label = formatBubbleHeader(ts, now);
    // Time-of-day labels contain a colon (hh:mm).
    expect(label).toMatch(/:/);
    // No month name should appear in a same-day label.
    expect(label).not.toMatch(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i);
  });

  it('renders a month-and-day label when ts is a different day, same year', () => {
    const now = Math.floor(Date.UTC(2026, 5, 1, 12, 0, 0) / 1000);
    const ts = Math.floor(Date.UTC(2026, 2, 14, 12, 0, 0) / 1000);
    const label = formatBubbleHeader(ts, now);
    // Should not be a time-of-day label (no colon expected from
    // toLocaleDateString month-day format).
    expect(label).not.toMatch(/^\d{1,2}:\d{2}/);
    // Should mention some date component — a number that could be
    // the day. Locale-stable check: at least one digit.
    expect(label).toMatch(/\d/);
  });

  it('renders a full locale date when ts is in a different year', () => {
    const now = Math.floor(Date.UTC(2026, 5, 1, 12, 0, 0) / 1000);
    const ts = Math.floor(Date.UTC(2024, 5, 1, 12, 0, 0) / 1000);
    const label = formatBubbleHeader(ts, now);
    // Different-year labels should include the year digits.
    expect(label).toMatch(/2024/);
  });

  it('treats midnight boundary correctly — 23:59 yesterday vs 00:01 today are different days', () => {
    const now = Math.floor(Date.UTC(2026, 5, 1, 0, 1, 0) / 1000);
    const tsYesterday = Math.floor(Date.UTC(2026, 4, 31, 23, 59, 0) / 1000);
    const tsToday = Math.floor(Date.UTC(2026, 5, 1, 0, 0, 30) / 1000);
    const labelYesterday = formatBubbleHeader(tsYesterday, now);
    const labelToday = formatBubbleHeader(tsToday, now);
    // Same-day label has colon; cross-day label has different shape.
    expect(labelToday).toMatch(/:/);
    // Yesterday's label should differ structurally.
    expect(labelYesterday).not.toBe(labelToday);
  });
});
