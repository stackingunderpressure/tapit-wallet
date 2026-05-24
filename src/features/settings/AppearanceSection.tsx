import type { Prefs, ThemeChoice } from '../storage/prefsStore.ts';

const THEME_OPTIONS: ReadonlyArray<{
  value: ThemeChoice;
  label: string;
  description: string;
}> = [
  {
    value: 'classic',
    label: 'Classic',
    description:
      'The original ink-on-paper surface. Quietly considered serif, light backdrop, accent green.',
  },
  {
    value: 'fresh',
    label: 'Fresh',
    description:
      'A younger-audience theme — deep neutral surface, electric accents, motion-first. Same cryptographic core; only the visual register changes.',
  },
  {
    value: 'system',
    label: 'System',
    description:
      'Follows your device. Dark mode resolves to Fresh; light mode resolves to Classic.',
  },
];

interface Props {
  prefs: Prefs;
  updatePrefs: (next: Partial<Prefs>) => Promise<void>;
}

/**
 * The Settings → Appearance section. Lets the operator pick which
 * presentation theme the wallet renders under. Shipped as part of
 * Cut 1 of the Fresh young-adult-friendly theme + IA roadmap
 * (2026-05-24). Stays in its own file because SettingsScreen.tsx
 * is already near the 800-line file-size limit.
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
  // The Fresh-only toggles surface once the operator has picked
  // Fresh OR System — under Classic they would have no effect, so
  // hiding them avoids cluttering the Settings surface for
  // operators who have not opted in.
  const showFreshToggles = prefs.theme === 'fresh' || prefs.theme === 'system';

  return (
    <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
      <div className="font-medium">Appearance</div>
      <p className="mt-1 text-sm text-muted">
        Pick the surface this wallet renders under. Classic is the
        original ink-on-paper register. Fresh is a younger-audience
        theme with a deep neutral surface and electric accents.
        Same cryptographic core, same envelope kinds, same recovery
        story under both — only the visuals change.
      </p>
      <div className="mt-3 space-y-2">
        {THEME_OPTIONS.map((option) => {
          const checked = prefs.theme === option.value;
          return (
            <label
              key={option.value}
              className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                checked
                  ? 'border-accent bg-accent/[0.06]'
                  : 'border-ink/15 hover:bg-ink/[0.03]'
              }`}
            >
              <input
                type="radio"
                name="theme-choice"
                value={option.value}
                checked={checked}
                onChange={() => updatePrefs({ theme: option.value })}
                className="mt-1"
              />
              <span className="flex-1">
                <span className="block text-sm font-medium">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {option.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {showFreshToggles && (
        <div className="mt-4 border-t border-ink/10 pt-4 space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted">
            Fresh extras
          </div>
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
      )}
    </section>
  );
}
