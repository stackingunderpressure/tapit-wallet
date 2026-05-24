import { useEffect, useState } from 'react';
import type { ThemeChoice } from '../storage/prefsStore.ts';
import { applyTheme, resolveTheme } from './applyTheme.ts';
import { loadDeviceTheme } from './deviceTheme.ts';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function readPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(DARK_QUERY).matches;
}

/**
 * Apply the device-level theme to the document. Used by pre-auth
 * surfaces (LoginPage, AuthGate's loading shell) that cannot read
 * prefs because the wallet is not unlocked yet. Reads from the
 * localStorage mirror that `useTheme` writes to whenever the
 * operator changes Appearance — so the pre-auth surface always
 * paints under the last applied choice.
 *
 * Subscribes to prefers-color-scheme when the stored choice is
 * 'system' so the surface flips automatically when the OS dark-
 * mode setting toggles. Falls back to 'classic' when nothing is
 * persisted (first-run on a new device).
 *
 * Returns the currently-resolved theme so the caller can branch
 * its rendering (e.g. LoginPage chooses FreshLoginShell vs the
 * Classic WalletGuide).
 */
export function useDeviceTheme(): 'classic' | 'fresh' {
  // First-run fallback flipped from 'classic' to 'fresh' on
  // 2026-05-24 per operator direction. A device that has never
  // written tapit-wallet:device-theme paints Fresh by default so
  // the pre-auth surface (LoginPage, the FreshOnboarding compose-
  // before-login flow) lands new users on the audience-targeted
  // surface from first touch. Existing operators who already
  // picked a theme keep their saved choice via loadDeviceTheme.
  const [choice, setChoice] = useState<ThemeChoice>(
    () => loadDeviceTheme() ?? 'fresh',
  );
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

  // Pick up changes made by another tab / by useTheme inside the
  // post-auth WalletProvider — the storage event fires on the
  // listening tab when a different tab writes to localStorage.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: StorageEvent) => {
      if (event.key !== 'tapit-wallet:device-theme') return;
      const next = loadDeviceTheme();
      if (next !== null) setChoice(next);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const resolved = resolveTheme(choice, prefersDark);

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  return resolved;
}
