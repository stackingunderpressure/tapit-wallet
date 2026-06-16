import { useMemo, useState } from 'react';
import type { Attestation, FieldBranch } from 'tapit-attest';
import { JournalCard } from './JournalCard.tsx';
import { allTags, entriesWithTags } from './journalTags.ts';

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

export function JournalTabs({ entries }: Props) {
  const tabs = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) set.add(category(e));
    const arr = [...set].sort();
    return [ALL, ...arr];
  }, [entries]);

  const [active, setActive] = useState<string>(ALL);
  // Tag filter — tap tags to narrow (AND). Combined with the category tab.
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const tagOptions = useMemo(() => allTags(entries), [entries]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.some((t) => t.toLowerCase() === tag.toLowerCase())
        ? prev.filter((t) => t.toLowerCase() !== tag.toLowerCase())
        : [...prev, tag],
    );
  }

  const visible = useMemo(() => {
    const byCategory =
      active === ALL ? entries : entries.filter((e) => category(e) === active);
    return entriesWithTags(byCategory, selectedTags);
  }, [entries, active, selectedTags]);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted">
        No entries yet. Tap “New entry” to sign your first one.
      </p>
    );
  }

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActive(t)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-sm border ${
              active === t
                ? 'bg-ink text-paper border-ink'
                : 'bg-white text-ink border-ink/15'
            }`}
          >
            {t === ALL ? 'All' : t}
          </button>
        ))}
      </div>
      {tagOptions.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wide text-muted">
            Tags
          </span>
          {tagOptions.map(({ tag, count }) => {
            const active = selectedTags.some(
              (t) => t.toLowerCase() === tag.toLowerCase(),
            );
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                aria-pressed={active}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                  active
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-ink/15 bg-white text-ink hover:bg-ink/[0.04]'
                }`}
              >
                {tag}
                <span className="ml-1 text-[10px] text-muted">{count}</span>
              </button>
            );
          })}
          {selectedTags.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedTags([])}
              className="text-xs text-muted underline"
            >
              clear
            </button>
          )}
        </div>
      )}
      <div className="mt-3 space-y-3">
        {visible.length === 0 ? (
          <p className="text-sm text-muted">
            No entries match these tags.
          </p>
        ) : (
          visible.map((a, i) => <JournalCard key={i} attestation={a} />)
        )}
      </div>
    </div>
  );
}
