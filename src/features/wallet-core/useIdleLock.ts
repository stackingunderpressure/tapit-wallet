import { useEffect, useRef } from 'react';

// Idle-lock helper. Listens for user activity (mousedown, keydown,
// touchstart, scroll, visibility) and resets a timer. When the
// timer fires, calls onIdle — which the caller wires up to
// transition the wallet back into the locked phase, clearing the
// in-memory passphrase. mousemove is intentionally NOT listened
// to because it fires too often and would mask a genuinely-idle
// session where the user just bumps the mouse passing by.
//
// timeoutMs = 0 disables the watcher entirely (operator chose
// "never" in Settings).

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
];

export function useIdleLock(timeoutMs: number, onIdle: () => void): void {
  const handlerRef = useRef(onIdle);
  handlerRef.current = onIdle;

  useEffect(() => {
    if (timeoutMs <= 0) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function fire() {
      if (cancelled) return;
      handlerRef.current();
    }

    function reset() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fire, timeoutMs);
    }

    // Returning from background counts as activity too — a phone
    // that comes back from sleep should not auto-lock immediately
    // unless the user has been away long enough that the timer
    // already expired. For simplicity v1 treats visibility-change
    // as activity (resets the timer); a stricter posture would
    // store the timestamp of last activity and check against
    // wall-clock on resume.
    function onVisibility() {
      if (document.visibilityState === 'visible') reset();
    }

    for (const ev of ACTIVITY_EVENTS) {
      document.addEventListener(ev, reset, { passive: true });
    }
    document.addEventListener('visibilitychange', onVisibility);
    reset();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      for (const ev of ACTIVITY_EVENTS) {
        document.removeEventListener(ev, reset);
      }
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [timeoutMs]);
}
