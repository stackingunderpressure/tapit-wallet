export interface HomeTab {
  id: string;
  label: string;
  /** Brand accent for a standout tab -- 'bitcoin' paints it Bitcoin orange. */
  accent?: 'bitcoin';
}

// Bitcoin orange (#F7931A) -- the same brand color the arena uses for its
// live price. Applied inline for the accent tab so the exact hue paints
// regardless of the palette, and so it never inherits the theme's ring.
const BITCOIN = '#F7931A';

/**
 * The fixed bottom tab strip -- extracted out of HomeScreen.tsx
 * (2026-08-16) purely to keep that file under the 800-line hard limit
 * once the Inbox tab landed; no behavior change from what was inline
 * there. Sticky-always per operator directive: header pinned top, tab
 * strip pinned bottom, content scrolls between. Centers on max-w-md so
 * the strip matches the page column width on wider viewports.
 *
 * A tab flagged `accent: 'bitcoin'` (the Beat HODL arena, 2026-09-05)
 * renders as a Bitcoin-orange button instead of the theme treatment.
 */
export function HomeTabStrip<T extends string>({
  tabs,
  active,
  onSelect,
  resolvedTheme,
}: {
  tabs: readonly { id: T; label: string; accent?: 'bitcoin' }[];
  active: T;
  onSelect: (id: T) => void;
  resolvedTheme: string;
}) {
  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-30 ${
        resolvedTheme === 'fresh'
          ? 'bg-fresh-surface-base/85 backdrop-blur-xl border-t border-fresh-surface-edge'
          : 'bg-paper/95 backdrop-blur border-t border-ink/10'
      }`}
    >
      <div
        className="max-w-md mx-auto px-5 pt-4 pb-8 flex rounded-none gap-1"
        role="tablist"
      >
        {tabs.map((t) => {
          const isActive = active === t.id;
          const isBitcoin = t.accent === 'bitcoin';
          const themeClasses =
            resolvedTheme === 'fresh'
              ? isActive
                ? 'bg-fresh-accent-secondary/20 text-fresh-text-primary ring-1 ring-fresh-accent-secondary/40'
                : 'text-fresh-text-tertiary'
              : isActive
                ? 'bg-white text-ink shadow-sm'
                : 'text-muted';
          const bitcoinStyle = isBitcoin
            ? isActive
              ? {
                  color: BITCOIN,
                  background: 'rgba(247,147,26,0.18)',
                  boxShadow: 'inset 0 0 0 1px rgba(247,147,26,0.5)',
                }
              : { color: BITCOIN, opacity: 0.85 }
            : undefined;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(t.id)}
              className={`flex-1 rounded-lg py-3 text-sm transition ${
                isBitcoin ? 'font-semibold' : `font-medium ${themeClasses}`
              }`}
              style={bitcoinStyle}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
