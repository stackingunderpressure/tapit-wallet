import type { ThemeChoice } from '../storage/prefsStore.ts';

/**
 * Fresh is the only look as of 2026-09-04 (operator: "just be the
 * fresh, get rid of the others, no option"). The theme picker is
 * gone and this resolver always returns 'fresh' regardless of the
 * stored choice — so every consumer (useTheme, useDeviceTheme, the
 * boot bootstrap) paints Fresh, and the `[data-theme="fresh"]`
 * attribute the CSS keys on is always present. The `choice` /
 * `prefersDark` params are kept so callers don't have to change,
 * but they no longer affect the result. Classic is unreachable.
 */
export function resolveTheme(
  _choice: ThemeChoice,
  _prefersDark: boolean,
): 'classic' | 'fresh' {
  return 'fresh';
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
 * Synchronous boot-time bootstrap. Paints the Fresh attribute BEFORE
 * React mounts so the first frame already carries the palette.
 * Called from `main.tsx` ahead of `createRoot`. Safe under SSR /
 * vitest. Fresh is the only look, so this is unconditional now.
 */
export function bootstrapDeviceTheme(): void {
  applyTheme('fresh');
}
