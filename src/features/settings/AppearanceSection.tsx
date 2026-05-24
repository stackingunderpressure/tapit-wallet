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
export function AppearanceSection({ prefs, updatePrefs }: Props) {
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
    </section>
  );
}
