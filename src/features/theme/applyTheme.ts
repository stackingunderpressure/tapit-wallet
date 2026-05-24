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
