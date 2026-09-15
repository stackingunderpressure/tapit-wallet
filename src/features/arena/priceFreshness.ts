// How old is the price on screen, in words the operator can act on.
//
// The arena shows a number you are about to make a permanent, signed move
// against. Showing it with no indication of its age is the quiet failure the
// operator hit in the field: the price looked authoritative, was minutes old,
// and the only cure was a manual refresh. A surface that states its own
// freshness lets you see the staleness instead of discovering it afterwards.
//
// PURE — `now` is injected, never read from the clock here, so it is testable.

export interface Freshness {
  /** Short label for next to the price, e.g. 'live' or 'updated 2m ago'. */
  label: string;
  /** True once the number is old enough that you should not trade on it
   *  without a refresh. The surface uses this to warn, never to block. */
  stale: boolean;
}

/** Older than this and the price stops being "the market right now". */
export const STALE_AFTER_MS = 90_000;

export function describeFreshness(fetchedAt: number | null, now: number = Date.now()): Freshness {
  if (fetchedAt == null || !Number.isFinite(fetchedAt)) {
    return { label: 'no price yet', stale: true };
  }
  const age = now - fetchedAt;
  // A clock that jumped backwards (device time change, DST) must not render
  // as a negative age or read as stale — treat anything not-yet-past as live.
  if (age < 10_000) return { label: 'live', stale: false };

  const stale = age >= STALE_AFTER_MS;
  if (age < 60_000) return { label: `updated ${Math.floor(age / 1000)}s ago`, stale };
  if (age < 3_600_000) return { label: `updated ${Math.floor(age / 60_000)}m ago`, stale };
  const hours = Math.floor(age / 3_600_000);
  return { label: `updated ${hours}h ago`, stale };
}
