export interface HomeTab {
  id: string;
  label: string;
}

/**
 * The fixed bottom tab strip -- extracted out of HomeScreen.tsx
 * (2026-08-16) purely to keep that file under the 800-line hard limit
 * once the Inbox tab landed; no behavior change from what was inline
 * there. Sticky-always per operator directive: header pinned top, tab
 * strip pinned bottom, content scrolls between. Centers on max-w-md so
 * the strip matches the page column width on wider viewports.
 */
export function HomeTabStrip<T extends string>({
  tabs,
  active,
  onSelect,
  resolvedTheme,
}: {
  tabs: readonly { id: T; label: string }[];
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
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => onSelect(t.id)}
            className={`flex-1 rounded-lg py-3 text-sm font-medium transition ${
              resolvedTheme === 'fresh'
                ? active === t.id
                  ? 'bg-fresh-accent-secondary/20 text-fresh-text-primary ring-1 ring-fresh-accent-secondary/40'
                  : 'text-fresh-text-tertiary'
                : active === t.id
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
