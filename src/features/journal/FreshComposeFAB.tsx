import { useScrollDirection } from './useScrollDirection.ts';

interface Props {
  onCompose: () => void;
  onWitnessSign: () => void;
}

// Thumb-reachable floating action button for journal composition
// under Fresh. Bottom-right primary (lime) for "+ new entry";
// secondary glass pill above it for witness co-signing. Hides on
// scroll-down to give the operator reading room, reappears on
// scroll-up — the same pattern Twitter / Threads use.
//
// Position 24px (right-6) from bottom-right. Primary is 56x56px
// (h-14 w-14) matching the brief. Press feedback uses the
// fresh-press keyframe with motion-reduce fallback.
//
// Shipped as part of Cut 4 of the 2026-05-24 Fresh roadmap.
export function FreshComposeFAB({ onCompose, onWitnessSign }: Props) {
  const direction = useScrollDirection();
  const hidden = direction === 'down';

  return (
    <div
      className={`fixed bottom-6 right-5 z-30 flex flex-col items-end gap-3 transition-all duration-300 motion-reduce:transition-none ${
        hidden
          ? 'pointer-events-none translate-y-24 opacity-0'
          : 'pointer-events-auto translate-y-0 opacity-100'
      }`}
    >
      <button
        type="button"
        onClick={onWitnessSign}
        aria-label="Sign someone else's entry"
        className="rounded-full bg-fresh-surface-glass backdrop-blur-xl border border-fresh-surface-edge px-4 py-2 text-xs font-medium text-fresh-text-primary shadow-lg shadow-black/20 transition active:animate-fresh-press motion-reduce:active:animate-none"
      >
        Witness an entry
      </button>
      <button
        type="button"
        onClick={onCompose}
        aria-label="New entry"
        className="h-14 w-14 rounded-full bg-fresh-accent-primary text-fresh-text-inverse text-2xl font-semibold shadow-[0_12px_40px_-8px_rgba(192,252,77,0.55)] flex items-center justify-center transition active:animate-fresh-press motion-reduce:active:animate-none"
      >
        +
      </button>
    </div>
  );
}
