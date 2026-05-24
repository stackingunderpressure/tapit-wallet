import { useMemo, useRef, useState, useEffect } from 'react';
import type { Attestation, FieldBranch } from 'tapit-attest';
import { FreshTodayCard } from './FreshTodayCard.tsx';

interface Props {
  entries: Attestation[];
}

function category(att: Attestation): string {
  const claim = att.claim as FieldBranch;
  const c = claim.children.find((x) => x.name === 'category');
  if (c && c.node === 'leaf' && typeof c.value === 'string') return c.value;
  return 'Diary';
}

const ALL = '__all';

// Stories-style horizontal carousel for the Today tab. One category
// fills the viewport; adjacent categories peek 12-16px into view as
// affordance. Snap-x scroll with snap-mandatory so the carousel
// settles cleanly between cards. Tap a category chip to jump to it.
//
// Replaces JournalTabs + JournalCard when the resolved theme is
// 'fresh'. Classic surface stays untouched — the gate happens
// upstream in HomeScreen so this file does not know about Classic
// at all.
//
// Shipped as part of Cut 3 of the 2026-05-24 Fresh roadmap.
export function FreshTodayCarousel({ entries }: Props) {
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) set.add(category(e));
    return [ALL, ...[...set].sort()];
  }, [entries]);

  const [active, setActive] = useState<string>(ALL);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Snap to the active category whenever the operator picks one
  // from the chip strip. Smooth scroll respects reduced-motion via
  // the CSS media query in index.css applied through Tailwind's
  // motion-reduce variant on the chip transitions.
  useEffect(() => {
    const target = sectionRefs.current.get(active);
    if (!target || !scrollerRef.current) return;
    target.scrollIntoView({
      behavior: 'smooth',
      inline: 'start',
      block: 'nearest',
    });
  }, [active]);

  if (entries.length === 0) {
    return (
      <div className="rounded-3xl border border-fresh-surface-edge bg-fresh-surface-glass backdrop-blur-xl p-8 text-center">
        <p className="text-fresh-text-secondary text-sm">
          Nothing here yet. Sign your first entry and it lives here forever
          — yours, math-proved, on your phone.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1 scrollbar-none">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActive(c)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium border transition active:animate-fresh-press motion-reduce:active:animate-none ${
              active === c
                ? 'bg-fresh-accent-primary text-fresh-text-inverse border-fresh-accent-primary'
                : 'bg-fresh-surface-glass text-fresh-text-secondary border-fresh-surface-edge hover:text-fresh-text-primary'
            }`}
          >
            {c === ALL ? 'All' : c}
          </button>
        ))}
      </div>

      <div
        ref={scrollerRef}
        className="mt-2 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-3 -mx-5 px-5 scrollbar-none"
        style={{ scrollPaddingLeft: '1.25rem' }}
      >
        {categories.map((c) => {
          const list = c === ALL ? entries : entries.filter((e) => category(e) === c);
          return (
            <section
              key={c}
              ref={(el) => {
                if (el) sectionRefs.current.set(c, el);
                else sectionRefs.current.delete(c);
              }}
              className="shrink-0 snap-start w-[calc(100%-1.5rem)] space-y-3 animate-fresh-rise motion-reduce:animate-none"
              aria-label={c === ALL ? 'All entries' : c}
            >
              {list.length === 0 ? (
                <div className="rounded-3xl border border-fresh-surface-edge bg-fresh-surface-glass backdrop-blur-xl p-8 text-center">
                  <p className="text-fresh-text-secondary text-sm">
                    Nothing in {c} yet.
                  </p>
                </div>
              ) : (
                list.map((a, i) => (
                  <FreshTodayCard key={i} attestation={a} />
                ))
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
