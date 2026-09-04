import type { Prefs } from '../storage/prefsStore.ts';

interface Props {
  prefs: Prefs;
  updatePrefs: (next: Partial<Prefs>) => Promise<void>;
}

/**
 * The Settings → Appearance section. The theme picker was removed on
 * 2026-09-04 (operator: "just be the fresh, no option") — Fresh is
 * the only look now, so this section keeps only the Fresh extras
 * (Memories, Streaks), which used to be gated behind picking Fresh.
 * Stays in its own file because SettingsScreen.tsx is near the
 * 800-line file-size limit.
 */
function FreshToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-ink/15 bg-white/60 p-3">
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        aria-label={label}
        className={`shrink-0 w-10 h-6 rounded-full transition-colors ${
          checked ? 'bg-accent' : 'bg-ink/15'
        }`}
      >
        <span
          className={`block h-5 w-5 bg-white rounded-full shadow transform transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

export function AppearanceSection({ prefs, updatePrefs }: Props) {
  return (
    <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
      <div className="font-medium">Appearance</div>
      <p className="mt-1 text-sm text-muted">
        Two optional touches on the Today surface. The entries themselves
        are the record either way.
      </p>
      <div className="mt-3 space-y-2">
        <FreshToggle
          label="Memories"
          description="Surface entries from 7, 30, and 365 days ago above Today. Per-day dismiss is also available on the strip itself."
          checked={prefs.memoriesEnabled}
          onChange={(next) => updatePrefs({ memoriesEnabled: next })}
        />
        <FreshToggle
          label="Streaks"
          description="Show a small day-streak indicator on Today. Off if you read it as guilt-inducing — the entries themselves are the record either way."
          checked={prefs.streaksEnabled}
          onChange={(next) => updatePrefs({ streaksEnabled: next })}
        />
      </div>
    </section>
  );
}
