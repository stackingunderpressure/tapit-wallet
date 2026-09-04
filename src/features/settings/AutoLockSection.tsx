import type { Prefs } from '../storage/prefsStore.ts';

/**
 * AutoLockSection — how long the wallet waits before re-prompting for the
 * passphrase on inactivity. Lower is safer if the phone is set down; higher
 * means fewer interruptions.
 */
export function AutoLockSection({
  prefs,
  updatePrefs,
}: {
  prefs: Prefs;
  updatePrefs: (next: Partial<Prefs>) => Promise<void>;
}) {
  return (
    <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
      <div className="font-medium">Auto-lock</div>
      <p className="mt-1 text-sm text-muted">
        Re-prompt for your passphrase after this much inactivity. Lower is safer
        if you set the phone down; higher means fewer interruptions.
      </p>
      <label className="mt-3 block">
        <span className="sr-only">Idle timeout</span>
        <select
          value={prefs.idleTimeoutMs}
          onChange={(e) => updatePrefs({ idleTimeoutMs: Number(e.target.value) })}
          className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
        >
          <option value={5 * 60 * 1000}>5 minutes</option>
          <option value={15 * 60 * 1000}>15 minutes</option>
          <option value={30 * 60 * 1000}>30 minutes (default)</option>
          <option value={60 * 60 * 1000}>1 hour</option>
          <option value={4 * 60 * 60 * 1000}>4 hours</option>
          <option value={0}>Never (until you sign out)</option>
        </select>
      </label>
    </section>
  );
}
