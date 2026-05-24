import type { ThemeChoice } from '../storage/prefsStore.ts';

/**
 * Resolve a ThemeChoice to the concrete theme that gets painted —
 * 'classic' or 'fresh'. 'system' inspects the platform's
 * prefers-color-scheme. Dark resolves to 'fresh' because the Fresh
 * palette is dark-default and that is the lived expectation of the
 * audience the roadmap targets; light resolves to 'classic' because
 * Light Fresh ships as a follow-on per the brief.
 */
export function resolveTheme(
  choice: ThemeChoice,
  prefersDark: boolean,
): 'classic' | 'fresh' {
  if (choice === 'classic') return 'classic';
  if (choice === 'fresh') return 'fresh';
  return prefersDark ? 'fresh' : 'classic';
}

/**
 * Apply the resolved theme to the document. Sets `<html
 * data-theme="fresh">` when fresh; removes the attribute when
 * classic so the `:root` defaults govern. No-op when `document` is
 * not available (e.g. during vitest's jsdom-less test paths).
 */
export function applyTheme(resolved: 'classic' | 'fresh'): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'fresh') {
    root.setAttribute('data-theme', 'fresh');
  } else {
    root.removeAttribute('data-theme');
  }
}

/**
 * Synchronous boot-time bootstrap. Reads the device-level theme
 * from localStorage and paints the document attribute BEFORE React
 * mounts so the first frame already carries the right palette —
 * no Classic-flash-then-Fresh-flicker on cold start. Called from
 * `main.tsx` ahead of `createRoot`. Safe under SSR / vitest.
 */
export function bootstrapDeviceTheme(): void {
  // First-run devices (and edge cases where localStorage is gone)
  // paint Fresh on the very first frame as of 2026-05-24 — Fresh
  // is the new default, so the cold-start surface should never
  // show as Classic-light to a brand-new operator just to flip a
  // tick later when React mounts and useDeviceTheme runs.
  if (typeof localStorage === 'undefined') {
    applyTheme('fresh');
    return;
  }
  let stored: string | null;
  try {
    stored = localStorage.getItem('tapit-wallet:device-theme');
  } catch {
    applyTheme('fresh');
    return;
  }
  if (stored !== 'classic' && stored !== 'fresh' && stored !== 'system') {
    applyTheme('fresh');
    return;
  }
  const prefersDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(resolveTheme(stored, prefersDark));
}
