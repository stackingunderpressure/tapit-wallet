import { useEffect, useState } from 'react';
import type { ThemeChoice } from '../storage/prefsStore.ts';
import { applyTheme, resolveTheme } from './applyTheme.ts';
import { saveDeviceTheme } from './deviceTheme.ts';

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

  // Mirror the operator's literal choice to localStorage so the
  // pre-auth surface (LoginPage) honours it on the next cold boot
  // and the post-sign-out landing renders under the right palette.
  // 'system' is preserved as-is so OS-follow behaviour persists.
  useEffect(() => {
    saveDeviceTheme(choice);
  }, [choice]);

  // Keep Fresh painted when the hook's owner unmounts (e.g.
  // WalletProvider tears down on sign-out). Fresh is the only look.
  useEffect(() => {
    return () => {
      applyTheme('fresh');
    };
  }, []);

  return resolved;
}
