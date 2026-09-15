import { describe, it, expect } from 'vitest';
import { describeFreshness, STALE_AFTER_MS } from './priceFreshness.ts';

// Only the pure age decision is unit-tested here. The hook's
// visibilitychange/focus/online refetch wiring is effect behaviour in a
// running browser — the repo carries no React renderer in tests (see
// useAutoBackup.test.ts, same split) — so it is covered by a device smoke,
// not by this file. Called out rather than implied.

const NOW = Date.parse('2026-09-15T12:00:00Z');
const at = (msAgo: number) => describeFreshness(NOW - msAgo, NOW);

describe('describeFreshness', () => {
  it('reads as live for the first few seconds', () => {
    expect(at(0)).toEqual({ label: 'live', stale: false });
    expect(at(9_000)).toEqual({ label: 'live', stale: false });
  });

  it('counts seconds, then minutes, then hours', () => {
    expect(at(30_000).label).toBe('updated 30s ago');
    expect(at(5 * 60_000).label).toBe('updated 5m ago');
    expect(at(3 * 3_600_000).label).toBe('updated 3h ago');
  });

  it('flips to stale exactly at the threshold, not before', () => {
    expect(at(STALE_AFTER_MS - 1_000).stale).toBe(false);
    expect(at(STALE_AFTER_MS).stale).toBe(true);
    expect(at(STALE_AFTER_MS + 60_000).stale).toBe(true);
  });

  it('says so plainly when there is no price yet, and calls it stale', () => {
    // Stale-not-fresh matters: "no price yet" must never render as a
    // trustworthy number, and the surface keys its warning off this flag.
    expect(describeFreshness(null, NOW)).toEqual({ label: 'no price yet', stale: true });
  });

  it('treats a non-finite timestamp as no price rather than throwing', () => {
    expect(describeFreshness(NaN, NOW).stale).toBe(true);
    expect(describeFreshness(Number.POSITIVE_INFINITY, NOW).stale).toBe(true);
  });

  it('does not render a negative age when the device clock jumps backwards', () => {
    // A DST shift or a manual clock change can put fetchedAt in the future.
    // "updated -8h ago" would be nonsense and, worse, reading it as stale
    // would nag the operator during a perfectly live session.
    const future = describeFreshness(NOW + 8 * 3_600_000, NOW);
    expect(future).toEqual({ label: 'live', stale: false });
    expect(future.label).not.toContain('-');
  });
});
