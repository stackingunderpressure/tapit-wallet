import { useEffect, useState } from 'react';
import type { ThemeChoice } from '../storage/prefsStore.ts';
import { applyTheme, resolveTheme } from './applyTheme.ts';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function readPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(DARK_QUERY).matches;
}

/**
 * Apply `choice` to the document and keep it in sync. When the
 * operator has picked 'system', the hook subscribes to the OS-level
 * prefers-color-scheme media query so the surface flips
 * automatically when the device's dark-mode setting toggles. Returns
 * the currently-resolved theme ('classic' | 'fresh') so callers can
 * gate conditional rendering without re-implementing the resolver.
 *
 * Safe under SSR / vitest — guards every browser-only API. The
 * effect is a no-op when `window` or `document` are not available.
 */
export function useTheme(choice: ThemeChoice): 'classic' | 'fresh' {
  const [prefersDark, setPrefersDark] = useState<boolean>(readPrefersDark);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof window.matchMedia !== 'function') return;
    if (choice !== 'system') return;
    const mq = window.matchMedia(DARK_QUERY);
    const handler = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    setPrefersDark(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [choice]);

  const resolved = resolveTheme(choice, prefersDark);

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  // Revert to Classic when the component owning the hook unmounts —
  // e.g. WalletProvider tears down on sign-out and the login surface
  // should always render under the Classic palette regardless of
  // what the previous operator had picked.
  useEffect(() => {
    return () => {
      applyTheme('classic');
    };
  }, []);

  return resolved;
}
