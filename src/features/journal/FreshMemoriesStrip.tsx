import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Attestation, FieldBranch } from 'tapit-attest';
import { envelopeId } from 'tapit-attest';
import { findMemoryEntries, type MemoryHit } from './findMemoryEntries.ts';

interface Props {
  entries: Attestation[];
}

const DISMISS_KEY = 'tapit-wallet:memories-dismissed-on';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isDismissedToday(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(DISMISS_KEY) === todayKey();
  } catch {
    return false;
  }
}

function dismissToday(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(DISMISS_KEY, todayKey());
  } catch {
    // Ignored — non-fatal.
  }
}

function readString(claim: FieldBranch, name: string): string | undefined {
  const child = claim.children.find((c) => c.name === name);
  if (!child || child.node !== 'leaf') return undefined;
  return typeof child.value === 'string' ? child.value : undefined;
}

function ageLabel(daysAgo: 7 | 30 | 365): string {
  if (daysAgo === 7) return 'A week ago today';
  if (daysAgo === 30) return 'A month ago today';
  return 'A year ago today';
}

// Anniversary surface for the Today tab. Surfaces journal entries
// from 7, 30, and 365 days ago — the math each entry carries
// (signed-at-date + anchor block height) is already there; this
// is just the lens. Per-day dismiss writes today's date key to
// localStorage so the strip stays hidden for the rest of the day
// without nagging.
//
// Shipped as part of Cut 4 of the 2026-05-24 Fresh roadmap.
export function FreshMemoriesStrip({ entries }: Props) {
  const [dismissed, setDismissed] = useState<boolean>(isDismissedToday);
  const hits: MemoryHit[] = useMemo(
    () => findMemoryEntries(entries),
    [entries],
  );

  if (dismissed || hits.length === 0) return null;

  function onDismiss() {
    dismissToday();
    setDismissed(true);
  }

  return (
    <section aria-label="Memories" className="mt-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs uppercase tracking-[0.18em] text-fresh-text-tertiary">
          Memories
        </h2>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-fresh-text-tertiary hover:text-fresh-text-primary transition"
          aria-label="Hide memories for today"
        >
          Hide for today
        </button>
      </div>
      <div className="mt-2 flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
        {hits.map((hit) => {
          const digest = envelopeId(hit.attestation);
          const text = readString(hit.attestation.claim, 'text');
          const anchor = hit.attestation.anchor;
          return (
            <Link
              key={digest}
              to={`/entry/${digest}`}
              className="shrink-0 w-64 rounded-2xl bg-fresh-surface-glass backdrop-blur-xl border border-fresh-surface-edge p-4 transition active:animate-fresh-press motion-reduce:active:animate-none"
            >
              <div className="text-xs font-medium text-fresh-accent-primary">
                {ageLabel(hit.daysAgo)}
              </div>
              {text && (
                <p className="mt-2 text-sm text-fresh-text-primary line-clamp-3">
                  {text}
                </p>
              )}
              <div className="mt-3 text-xs text-fresh-text-tertiary">
                {anchor?.status === 'confirmed' && anchor.btcHeight
                  ? `Block ${anchor.btcHeight} confirms it existed by then.`
                  : 'Signed and timestamped.'}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
