import { useEffect, useState } from 'react';

/**
 * Tracks the document's vertical scroll direction. Returns 'down'
 * when the user is actively scrolling further down the page,
 * 'up' otherwise (initial state, scrolling back up, or near the
 * top of the page). Used by FreshComposeFAB to hide on scroll-down
 * and reappear on scroll-up — a pattern that lets the operator see
 * more content while reading, and brings the action back the
 * moment they pause or reverse.
 *
 * Threshold is in pixels; scrolls smaller than the threshold do
 * not trigger a direction flip so jitter does not strobe the FAB.
 * The hook is a no-op under SSR / vitest.
 */
export function useScrollDirection(threshold = 8): 'up' | 'down' {
  const [direction, setDirection] = useState<'up' | 'down'>('up');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let lastY = window.scrollY;
    let ticking = false;

    const handle = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      if (Math.abs(delta) >= threshold) {
        if (y <= threshold) {
          setDirection('up');
        } else {
          setDirection(delta > 0 ? 'down' : 'up');
        }
        lastY = y;
      }
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(handle);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return direction;
}
