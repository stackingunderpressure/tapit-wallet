// New-version detection for the PWA (operator request 2026-06-01). The
// app is a network-first PWA, so a plain reload already pulls fresh
// hashed JS/CSS after a deploy — the missing piece is TELLING the
// operator a new build exists so they can reload deliberately instead
// of sitting on stale code until their next cold start.
//
// Mechanism: vite.config.ts stamps every build with a version (baked
// into the bundle as __APP_VERSION__ and written to /version.json). The
// running app periodically fetches /version.json and compares. A
// mismatch means the deployed build is newer than the running one ->
// show the banner.
//
// This module is the pure, testable core: fetch + compare. The React
// wiring (interval, visibility re-check, banner) lives in
// useUpdateAvailable.ts so the comparison logic can be unit-tested
// without a DOM or timers.

export interface VersionManifest {
  version: string;
}

/**
 * Decide whether an update is available given the currently-running
 * version and whatever the server returned. Conservative: only reports
 * an update when BOTH versions are present, non-empty, and differ. A
 * missing/blank/garbage fetched version returns false so a flaky deploy
 * of version.json never nags the operator with a phantom update.
 */
export function isUpdateAvailable(
  current: string,
  fetched: VersionManifest | null,
): boolean {
  if (!fetched) return false;
  const a = (current ?? '').trim();
  const b = (fetched.version ?? '').trim();
  if (a.length === 0 || b.length === 0) return false;
  return a !== b;
}

/**
 * Fetch /version.json with cache busting. Returns null on any failure
 * (offline, 404 in dev, malformed JSON) so the caller treats "couldn't
 * check" exactly like "no update" — silence, never a false alarm. The
 * cache: 'no-store' + query nonce defeat both the HTTP cache and the
 * service worker's stale-while-revalidate so the check reads the
 * freshly-deployed file, not a cached copy.
 */
export async function fetchVersion(
  signal?: AbortSignal,
): Promise<VersionManifest | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      signal,
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (
      typeof data === 'object' &&
      data !== null &&
      typeof (data as Record<string, unknown>).version === 'string'
    ) {
      return { version: (data as Record<string, unknown>).version as string };
    }
    return null;
  } catch {
    return null;
  }
}
