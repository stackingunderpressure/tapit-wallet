import { useEffect } from 'react';

// Lock background page scroll while a modal/overlay is mounted, so the
// overlay is the dominant interaction layer and the page behind it doesn't
// move under touch (the iOS "the screen behind is the live scroll" bug).
// Ref-counted so stacked overlays each hold the lock and only the last one
// to unmount restores the page's prior overflow. Restores exactly what was
// there before rather than assuming a default.

let lockCount = 0;
let prevOverflow = '';

export function useBodyScrollLock(active = true): void {
  useEffect(() => {
    if (!active) return;
    if (typeof document === 'undefined') return;
    if (lockCount === 0) {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.overflow = prevOverflow;
      }
    };
  }, [active]);
}
