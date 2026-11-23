import { createContext, useContext, useId, useState, type ReactNode } from 'react';

/**
 * Settings layout, two levels (operator, 2026-11-23: a sub-item must clearly
 * belong to its main header and never look like another main header).
 *
 * CategoryGroup — a main header. Bold row with a chevron. When open, it and
 * its items sit together in one panel with a coloured edge, so the items read
 * as inside it. Only one category is open at a time (opening the next one
 * closes the last), so the page never turns into one long run of rows.
 *
 * SettingsItem — a sub-item inside an open category: smaller text, indented
 * behind a coloured rule, no card of its own. Only the item tapped opens its
 * controls.
 */

const Accordion = createContext<{ openId: string | null; setOpenId: (id: string | null) => void } | null>(null);

/** Wrap the categories so only one is open at a time. */
export function CategoryAccordion({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return <Accordion.Provider value={{ openId, setOpenId }}>{children}</Accordion.Provider>;
}

export function CategoryGroup({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const id = useId();
  const acc = useContext(Accordion);
  const [localOpen, setLocalOpen] = useState(false);
  const open = acc ? acc.openId === id : localOpen;
  const toggle = () => (acc ? acc.setOpenId(open ? null : id) : setLocalOpen((v) => !v));
  return (
    <div
      className={`mt-3 rounded-2xl border transition-colors ${
        open ? 'border-fresh-accent-secondary bg-ink/[0.05]' : 'border-ink/10 bg-ink/[0.03]'
      }`}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full min-h-[44px] flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-base font-semibold">{title}</span>
          {subtitle && <span className="mt-0.5 block text-xs text-muted">{subtitle}</span>}
        </span>
        <span className={`shrink-0 text-lg text-muted transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden>
          ›
        </span>
      </button>
      {open && (
        <div className="mb-3 ml-4 mr-2 border-l-2 border-fresh-accent-secondary pl-2">{children}</div>
      )}
    </div>
  );
}

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
    <div className="border-b border-ink/10 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full min-h-[44px] flex items-center justify-between gap-3 py-2.5 pl-2 pr-2 text-left"
      >
        <span>
          <span className={`block text-sm ${open ? 'font-medium text-fresh-accent-secondary' : 'font-normal'}`}>{title}</span>
          <span className="mt-0.5 block text-[11px] leading-snug text-muted">{description}</span>
        </span>
        <span className={`shrink-0 text-xs text-muted transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden>
          ›
        </span>
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}
