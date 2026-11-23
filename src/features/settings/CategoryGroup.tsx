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

/**
 * SettingsItem — one tappable row inside an open category: a name and a
 * plain-language line saying what it is for, expanding to the control itself.
 * Second level of the progressive layout: categories open to a short list of
 * items, and only the item you tap opens its controls.
 */
export function SettingsItem({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 rounded-xl border border-ink/10 bg-white/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full min-h-[44px] flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-sm font-medium">{title}</span>
          <span className="mt-0.5 block text-xs text-muted">{description}</span>
        </span>
        <span className={`shrink-0 text-muted transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden>
          ›
        </span>
      </button>
      {open && <div className="px-2 pb-2">{children}</div>}
    </div>
  );
}
