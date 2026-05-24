import { useMemo, useState } from 'react';
import type { Attestation, FieldBranch } from 'tapit-attest';
import { FreshTodayCard } from './FreshTodayCard.tsx';
import { useWallet } from '../wallet-core/useWallet.ts';
import { categoryAccent } from './categoryAccents.ts';

interface Props {
  entries: Attestation[];
}

function category(att: Attestation): string {
  const claim = att.claim as FieldBranch;
  const c = claim.children.find((x) => x.name === 'category');
  if (c && c.node === 'leaf' && typeof c.value === 'string') return c.value;
  return 'Diary';
}

function writtenAt(att: Attestation): number {
  const claim = att.claim as FieldBranch;
  const w = claim.children.find((x) => x.name === 'written_at');
  const raw =
    w && w.node === 'leaf' && typeof w.value === 'string'
      ? w.value
      : att.issuedAt;
  return new Date(raw).getTime();
}

const ALL = '__all';
const ME = '__me';
const OTHERS = '__others';

type SortChoice = 'newest' | 'oldest';
type SubjectFilter = typeof ALL | typeof ME | typeof OTHERS;

// Vertical sort-and-filter list for journal entries under Fresh.
//
// The brief originally sketched a Stories-style horizontal snap
// carousel, but operator feedback on the 2026-05-24 live deploy
// flagged the carousel as the wrong shape — they wanted to see
// everything at once, with sort and filter dimensions they could
// pick from. The vertical list is the response: a sort chip pair
// (Newest / Oldest), a category chip strip (All + the categories
// the operator has actually used), a subject chip strip (All /
// About me / About others), then a vertical stack of cards. Each
// card carries a per-category accent stripe + a synthetic title
// so the list scans cleanly.
//
// The bottom of the list reserves a 24-unit pad so the floating
// compose FAB never sits on top of the last card's metadata.
export function FreshTodayCarousel({ entries }: Props) {
  const walletKey = useWallet().wallet.identity;

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) set.add(category(e));
    return [ALL, ...[...set].sort()];
  }, [entries]);

  const subjectFilters: ReadonlyArray<{ value: SubjectFilter; label: string }> = [
    { value: ALL, label: 'Everyone' },
    { value: ME, label: 'About me' },
    { value: OTHERS, label: 'About others' },
  ];

  const [activeCategory, setActiveCategory] = useState<string>(ALL);
  const [activeSubject, setActiveSubject] = useState<SubjectFilter>(ALL);
  const [sort, setSort] = useState<SortChoice>('newest');

  const filtered = useMemo(() => {
    let list = entries;
    if (activeCategory !== ALL) {
      list = list.filter((e) => category(e) === activeCategory);
    }
    if (activeSubject === ME) {
      list = list.filter((e) => e.subject === walletKey);
    } else if (activeSubject === OTHERS) {
      list = list.filter((e) => e.subject !== walletKey);
    }
    const sorted = [...list].sort((a, b) =>
      sort === 'newest' ? writtenAt(b) - writtenAt(a) : writtenAt(a) - writtenAt(b),
    );
    return sorted;
  }, [entries, activeCategory, activeSubject, sort, walletKey]);

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
    <div className="space-y-3">
      {/* Sort toggle — pair of pills, the active one in lime. */}
      <div className="flex items-center gap-2">
        <span className="text-[0.62rem] uppercase tracking-[0.22em] text-fresh-text-tertiary">
          Sort
        </span>
        {(['newest', 'oldest'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSort(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition active:animate-fresh-press motion-reduce:active:animate-none ${
              sort === s
                ? 'bg-fresh-accent-primary text-fresh-text-inverse border-fresh-accent-primary'
                : 'bg-fresh-surface-glass text-fresh-text-secondary border-fresh-surface-edge hover:text-fresh-text-primary'
            }`}
          >
            {s === 'newest' ? 'Newest first' : 'Oldest first'}
          </button>
        ))}
      </div>

      {/* Category chip strip — colored dot per chip so the
          category-accent vocabulary is visible at the filter
          level too, not just on each card. */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {categories.map((c) => {
          const active = activeCategory === c;
          const accent = c === ALL ? null : categoryAccent(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCategory(c)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium border transition active:animate-fresh-press motion-reduce:active:animate-none flex items-center gap-1.5 ${
                active
                  ? 'border-fresh-accent-primary text-fresh-text-primary bg-fresh-accent-primary/[0.12]'
                  : 'bg-fresh-surface-glass text-fresh-text-secondary border-fresh-surface-edge hover:text-fresh-text-primary'
              }`}
            >
              {accent && (
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: accent.hex }}
                />
              )}
              {c === ALL ? 'All categories' : c}
            </button>
          );
        })}
      </div>

      {/* Subject filter — Everyone / About me / About others. */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {subjectFilters.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setActiveSubject(s.value)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium border transition active:animate-fresh-press motion-reduce:active:animate-none ${
              activeSubject === s.value
                ? 'border-fresh-accent-secondary text-fresh-text-primary bg-fresh-accent-secondary/[0.14]'
                : 'bg-fresh-surface-glass text-fresh-text-secondary border-fresh-surface-edge hover:text-fresh-text-primary'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Result count + vertical card stack. pb-28 reserves room
          for the compose FAB to sit over empty space instead of
          the last card's metadata. */}
      <div className="pt-1">
        <p className="text-[0.62rem] uppercase tracking-[0.22em] text-fresh-text-tertiary">
          {filtered.length === 0
            ? 'No entries match these filters'
            : filtered.length === 1
              ? '1 entry'
              : `${filtered.length} entries`}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-fresh-surface-edge bg-fresh-surface-glass backdrop-blur-xl p-8 text-center">
          <p className="text-fresh-text-secondary text-sm">
            Nothing matches. Try widening a filter above.
          </p>
        </div>
      ) : (
        <div className="space-y-3 animate-fresh-rise motion-reduce:animate-none pb-28">
          {filtered.map((a, i) => (
            <FreshTodayCard key={i} attestation={a} />
          ))}
        </div>
      )}
    </div>
  );
}
