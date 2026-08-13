import { useCirclePhraseDeliveries } from './useCirclePhraseDeliveries.ts';

// Invisible in the common case -- this hook needs to be mounted somewhere
// live so a phrase pair arriving while the operator is on the home screen
// gets received and stored immediately, not only when they happen to open
// Settings. Renders a small transient confirmation only right after a
// delivery lands; the durable status view lives in Settings
// (CirclePhraseSection.tsx), which reads what was actually stored rather
// than this session's in-memory list.
//
// 2026-08-11 fix (operator: "Shows message at the top every single time I
// open app. They are not acknowledging and turning banner off") -- two
// bugs, not one. The relay-backlog-replay root cause (every historical
// delivery re-triggering this banner on every app open) is fixed in
// useCirclePhraseDeliveries.ts's own persisted dedupe; this component's
// half is the dismiss control that was simply missing -- there was no way
// to acknowledge and close it even within one session.
export function CirclePhraseReceiver() {
  const { savedVaultNames, dismiss } = useCirclePhraseDeliveries();
  if (savedVaultNames.length === 0) return null;

  return (
    <div className="relative mx-4 mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 pr-10 text-emerald-900">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-0 top-0 w-11 h-11 flex items-center justify-center text-lg text-emerald-700/70 hover:text-emerald-900"
      >
        &times;
      </button>
      <p className="text-sm font-medium">
        Safety phrase{savedVaultNames.length === 1 ? '' : 's'} saved
      </p>
      <p className="mt-1 text-xs">
        {savedVaultNames.join(', ')} sent you a phone-callback phrase pair. It&apos;s saved
        on this device only -- see Settings for details.
      </p>
    </div>
  );
}
