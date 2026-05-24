import type { ThemeChoice } from '../storage/prefsStore.ts';

// Device-level theme persistence. Distinct from prefs.theme, which
// is per-operator and lives behind unlock. The pre-auth surface
// (LoginPage, WalletGuide-as-/about) cannot read prefs because the
// wallet is not unlocked yet — but the operator still expects the
// surface to honour their last choice. The device-theme accessor
// mirrors the most-recently-applied theme to localStorage so the
// pre-auth surface can read it synchronously at boot.
//
// localStorage rather than IndexedDB so the read is synchronous and
// can happen before React mounts — preventing a Classic-flash-then-
// Fresh-flicker on cold start.
//
// Stores 'classic' | 'fresh' (the resolved value) or 'system' (the
// operator's literal choice when they want OS-following behaviour).
// 'system' on the device layer means "re-resolve from prefers-color-
// scheme at boot time."

const KEY = 'tapit-wallet:device-theme';

const VALID: ReadonlySet<ThemeChoice> = new Set<ThemeChoice>([
  'classic',
  'fresh',
  'system',
]);

function isThemeChoice(value: string): value is ThemeChoice {
  return VALID.has(value as ThemeChoice);
}

/**
 * Read the persisted device-level theme. Returns null when no value
 * has been written (first-run) so callers can apply their own
 * default. Safe under SSR / vitest — guards localStorage.
 */
export function loadDeviceTheme(): ThemeChoice | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return null;
    return isThemeChoice(raw) ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Write the device-level theme. Called every time the operator
 * changes Appearance in Settings so the next pre-auth render — or
 * the next cold boot — paints the right surface immediately. Safe
 * under SSR / vitest.
 */
export function saveDeviceTheme(choice: ThemeChoice): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // Storage quota, private-browsing, etc. The wallet still
    // functions; the operator's choice just doesn't persist to the
    // pre-auth surface across sessions. Non-fatal.
  }
}
