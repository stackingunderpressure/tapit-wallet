import { useUpdateAvailable } from './useUpdateAvailable.ts';

// Top-of-screen "a new version is ready" banner (operator request
// 2026-06-01). Appears only when useUpdateAvailable detects a newer
// deployed build; tapping it hard-reloads so the browser pulls the
// fresh hashed bundle (navigation is already network-first, so the
// reload alone updates the app — this banner is the deliberate trigger
// + the notice that one is waiting).
//
// Layout notes the operator asked for explicitly: PLENTY of padding at
// the top so the tap target clears the notch / status bar and sits
// where a thumb can comfortably reach it. We add the iOS safe-area
// inset (env(safe-area-inset-top)) PLUS a generous fixed pad on top of
// it, and a tall touch target (min-h tap area). position:fixed so it
// floats above whatever screen is mounted (login, unlock, home) and is
// always reachable.

function reloadNow() {
  // Hard reload. The SW is network-first for navigations and
  // skipWaiting/claims on activate, so a normal reload already fetches
  // and runs the new build; location.reload() is the deliberate kick.
  window.location.reload();
}

export function UpdateBanner() {
  const available = useUpdateAvailable();
  if (!available) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[100]"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      role="alert"
    >
      <div className="mx-auto max-w-md px-3 pb-3">
        <button
          type="button"
          onClick={reloadNow}
          className="flex w-full min-h-[52px] items-center justify-between gap-3 rounded-2xl bg-accent px-4 py-3.5 text-left text-paper shadow-lg shadow-accent/30 active:scale-[0.99] transition"
        >
          <span className="flex flex-col">
            <span className="text-sm font-semibold">
              A new version is ready
            </span>
            <span className="text-xs opacity-90">
              Tap to update and reload
            </span>
          </span>
          <span
            aria-hidden
            className="shrink-0 rounded-full bg-paper/20 px-3 py-1.5 text-xs font-semibold"
          >
            Update
          </span>
        </button>
      </div>
    </div>
  );
}
