import { Link } from 'react-router-dom';
import { backupNudge, type BackupNudgeInput } from './backupNudge.ts';

// The "set up a way back in" home-screen banner. Sits below backup
// health, links to Settings, and retires once any recovery path is
// established (recovery key seen / file downloaded / cohort declared).
// Extracted from HomeScreen to keep that file under the 800-line hard
// limit; the decision logic is the pure backupNudge helper.
export function BackupNudgeBanner(props: BackupNudgeInput) {
  const nudge = backupNudge(props);
  if (!nudge) return null;
  return (
    <Link
      to="/settings"
      className="mt-3 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 hover:bg-amber-100"
      role="status"
    >
      <span className="flex-1">{nudge.text}</span>
      <span className="shrink-0 self-center rounded border border-amber-400 px-2 py-1 text-xs font-semibold text-amber-900">
        {nudge.cta}
      </span>
    </Link>
  );
}
