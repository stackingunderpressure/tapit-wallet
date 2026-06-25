// postLoginReturn.ts -- remember where an authenticated deep link was headed.
//
// When a signed-out person lands on a gated deep link (the canonical case is
// /sign?req=... -- an outside app like DynastyTrust asking the wallet to prove
// key control), AuthGate bounces them to /login. Without this, the original
// request is silently dropped and a brand-new user who then creates a wallet
// is stranded on the home screen, never returned to finish what they came for.
//
// We stash the intended path through the login round-trip (which, for magic
// link / OAuth, leaves the app entirely), so localStorage -- not router state
// -- is the only thing durable enough to survive it. Same-origin relative
// paths only, so this can never become an open redirect.

const KEY = 'tapit_post_login_return';

function isSafeRelative(path: string): boolean {
  // Must be a same-origin relative path. Reject protocol-relative ("//evil")
  // and absolute URLs, and never loop back to the auth surfaces themselves.
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  if (path === '/login' || path.startsWith('/auth/')) return false;
  return true;
}

export function stashPostLoginReturn(path: string): void {
  if (!isSafeRelative(path)) return;
  try {
    localStorage.setItem(KEY, path);
  } catch {
    // storage unavailable (private mode) -- return path is best-effort.
  }
}

/** Read and clear the stashed return path. Returns null when none/unsafe. */
export function takePostLoginReturn(): string | null {
  try {
    const path = localStorage.getItem(KEY);
    if (path) localStorage.removeItem(KEY);
    if (path && isSafeRelative(path)) return path;
  } catch {
    // ignore
  }
  return null;
}
