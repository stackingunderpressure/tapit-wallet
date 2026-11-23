// Is the wallet running as an installed app (added to the Home Screen) or in
// a browser tab? On iPhone the two keep SEPARATE storage, and an installed
// app is treated better by the browser's storage rules, so the wallet tells
// the person which one they are in (SOVEREIGN_SYNC_PLAN.md section 5).

interface EnvLike {
  matchMedia?: (q: string) => { matches: boolean };
  navigator?: { standalone?: boolean; userAgent?: string };
}

const realEnv = (): EnvLike => (typeof window === 'undefined' ? {} : (window as unknown as EnvLike));

export function isInstalledApp(env: EnvLike = realEnv()): boolean {
  if (env.navigator?.standalone === true) return true; // iOS Safari
  return !!env.matchMedia?.('(display-mode: standalone)').matches;
}

export function isPhoneOrTablet(env: EnvLike = realEnv()): boolean {
  return /iPhone|iPad|iPod|Android/i.test(env.navigator?.userAgent ?? '');
}

export function isApplePhone(env: EnvLike = realEnv()): boolean {
  return /iPhone|iPad|iPod/i.test(env.navigator?.userAgent ?? '');
}
