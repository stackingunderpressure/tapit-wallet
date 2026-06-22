import { useState, type ReactNode } from 'react';
import { LESSONS, type LessonContent } from './literacy.ts';

// ExplainChip — the tappable inline explainer (TW-1). Drop it next to any
// concept in the UI and a curious person can tap to reveal the teaching in
// honest tiers: first the plain-English consequence (what it does FOR
// them), then why it works, then the real crypto name for the few who want
// to go look it up. Only tiers that exist for a lesson are shown, and each
// tap reveals the next deeper tier — discovery at the user's own pace,
// never a wall of jargon up front. This is sovereignty-literacy-through-use
// made reusable: one chip, every concept, the catalog in literacy.ts.

interface Props {
  /** A key into LESSONS (e.g. 'threshold', 'recovery-cohort'). */
  concept: string;
  /** Optional trigger label; defaults to a small "Why this?" affordance. */
  label?: ReactNode;
}

// The reveal order, shallowest first. Tapping deepens by one tier; only
// tiers the lesson actually defines are surfaced.
const TIERS: { key: keyof LessonContent; heading: string }[] = [
  { key: 'consequence', heading: 'What this does for you' },
  { key: 'whyItWorks', heading: 'Why it works' },
  { key: 'theCrypto', heading: 'Under the hood' },
];

export function ExplainChip({ concept, label }: Props) {
  // depth 0 = closed; depth N = N tiers revealed.
  const [depth, setDepth] = useState(0);
  const lesson = LESSONS[concept];

  if (!lesson) return null;

  // Which tiers this lesson can actually show, in order.
  const available = TIERS.filter(
    (t) => typeof lesson[t.key] === 'string' && (lesson[t.key] as string).length > 0,
  );
  if (available.length === 0) return null;

  const open = depth > 0;
  const shown = available.slice(0, depth);
  const hasMore = depth < available.length;

  function onTrigger() {
    setDepth((d) => (d === 0 ? 1 : d >= available.length ? 0 : d + 1));
  }

  const triggerLabel =
    label ?? (open ? (hasMore ? 'Tell me more' : 'Got it') : 'Why this?');

  return (
    <span className="inline-flex flex-col gap-1 align-top text-left">
      <button
        type="button"
        onClick={onTrigger}
        aria-expanded={open}
        className="inline-flex w-fit items-center gap-1 rounded-full border border-ink/15 bg-ink/[0.03] px-2 py-0.5 text-xs font-medium text-muted transition hover:text-ink active:animate-fresh-press motion-reduce:active:animate-none"
      >
        <span aria-hidden className="font-semibold text-ink/60">
          ?
        </span>
        <span>{triggerLabel}</span>
      </button>

      {open && (
        <span className="mt-1 flex flex-col gap-2 rounded-lg border border-ink/10 bg-white p-3 text-xs text-ink/80 shadow-sm">
          {shown.map((t) => (
            <span key={t.key} className="block">
              <span className="block font-medium text-ink">{t.heading}</span>
              <span className="mt-0.5 block">{lesson[t.key] as string}</span>
            </span>
          ))}

          {hasMore && (
            <span className="block text-[11px] text-muted">
              Tap again to go a layer deeper.
            </span>
          )}

          {lesson.ahaTrigger && !hasMore && (
            <span className="block border-t border-ink/10 pt-2 text-[11px] italic text-muted">
              {lesson.ahaTrigger}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
