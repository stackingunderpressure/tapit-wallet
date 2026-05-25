import { useCallback, useRef } from 'react';

// Long-press gesture detector. Tap-and-hold for `delay` ms fires
// the handler; a normal tap or scroll cancels. Returns props you
// spread onto any element you want long-pressable.
//
// Mobile-first: touch events come first, mouse events second so a
// dev-environment cursor still works. Move events with non-trivial
// delta cancel the press so a scroll gesture doesn't accidentally
// long-press the bubble the operator swiped through.

const DEFAULT_DELAY_MS = 450;
const MOVE_TOLERANCE_PX = 8;

export function useLongPress(onLongPress: () => void, delayMs = DEFAULT_DELAY_MS) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      startX.current = t.clientX;
      startY.current = t.clientY;
      clear();
      timer.current = setTimeout(() => {
        timer.current = null;
        onLongPress();
      }, delayMs);
    },
    [clear, onLongPress, delayMs],
  );

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    const dx = Math.abs(t.clientX - startX.current);
    const dy = Math.abs(t.clientY - startY.current);
    if (dx > MOVE_TOLERANCE_PX || dy > MOVE_TOLERANCE_PX) {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    }
  }, []);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      startX.current = e.clientX;
      startY.current = e.clientY;
      clear();
      timer.current = setTimeout(() => {
        timer.current = null;
        onLongPress();
      }, delayMs);
    },
    [clear, onLongPress, delayMs],
  );

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd: clear,
    onTouchCancel: clear,
    onMouseDown,
    onMouseUp: clear,
    onMouseLeave: clear,
  };
}
