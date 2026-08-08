import { useCirclePhraseDeliveries } from './useCirclePhraseDeliveries.ts';

// Invisible in the common case -- this hook needs to be mounted somewhere
// live so a phrase pair arriving while the operator is on the home screen
// gets received and stored immediately, not only when they happen to open
// Settings. Renders a small transient confirmation only right after a
// delivery lands; the durable status view lives in Settings
// (CirclePhraseSection.tsx), which reads what was actually stored rather
// than this session's in-memory list.
export function CirclePhraseReceiver() {
  const savedVaultNames = useCirclePhraseDeliveries();
  if (savedVaultNames.length === 0) return null;

  return (
    <div className="mx-4 mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
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
