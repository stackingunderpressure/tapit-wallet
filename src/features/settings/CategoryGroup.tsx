import { useState, type ReactNode } from 'react';

/**
 * CategoryGroup — one collapsible settings category. The header is a tappable
 * row; the child section cards (each self-contained) render below only when
 * open, so the Settings screen opens as a short list of categories instead of
 * one endless scroll. Backup & recovery opens by default (defaultOpen) because
 * it is the one group everyone should see.
 */
export function CategoryGroup({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-ink/[0.03] px-4 py-3 text-left hover:bg-ink/[0.05]"
      >
        <span>
          <span className="block font-semibold">{title}</span>
          {subtitle && <span className="mt-0.5 block text-xs text-muted">{subtitle}</span>}
        </span>
        <span
          className={`shrink-0 text-muted transition-transform ${open ? 'rotate-90' : ''}`}
          aria-hidden
        >
          ›
        </span>
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}
