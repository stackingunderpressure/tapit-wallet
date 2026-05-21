import { useMemo, useState } from 'react';
import type { Attestation, FieldBranch } from 'tapit-attest';
import { JournalCard } from './JournalCard.tsx';

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

  const visible = useMemo(() => {
    if (active === ALL) return entries;
    return entries.filter((e) => category(e) === active);
  }, [entries, active]);

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
      <div className="mt-3 space-y-3">
        {visible.map((a, i) => (
          <JournalCard key={i} attestation={a} />
        ))}
      </div>
    </div>
  );
}
