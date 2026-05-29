import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'anchoring',
  born: '2026-05-21',
  purpose:
    'OpenTimestamps anchoring of journal entries. The wallet stamps each attestation digest against an OpenTimestamps calendar on creation; a background worker polls pending anchors and upgrades them to confirmed once Bitcoin attests. Anchored receipts are tamper-evident in time, not just signature-valid.',
  touches: [
    'src/features/anchoring/anchorProvider.ts',
    'src/features/anchoring/anchorQueue.ts',
    'src/features/anchoring/anchorWorker.ts',
    'src/features/anchoring/useAnchorStatus.ts',
    'src/features/anchoring/useAnchorWorker.ts',
    'src/features/anchoring/verificationStatus.ts',
    'src/features/anchoring/verificationStatus.test.ts',
    'src/features/anchoring/hex.ts',
  ],
  depends_on: ['wallet-core', 'storage'],
  pause_safe: false,
  removal_safe: false,
  monetizable: false,
  notes:
    "verificationStatus.ts (2026-05-28 PLAN.md Tier 1 item 4) centralizes the anchor-from-attestation-or-row precedence the journal surfaces had been duplicating and adds a third derived state `stalled` — surfaces when the OpenTimestamps calendar has been unreachable across STALLED_AFTER_ATTEMPTS = 5 failed attempts (matches the worker's max 1hr backoff exponent, so a stalled row has been at the saturated retry interval long enough that the outage is structurally past 'transient'). JournalCard, JournalDetail, and FreshTodayCard all consume the helper now; the operator sees an amber 'Time-verifying — calendar slow' badge on Classic and a matching amber tile on Fresh rather than a perpetual 'Time-verifying…' that silently lurks during an extended calendar outage. Per the JournalCard doctrine the badge still never alarms — informational, never failure-framed. Uses tapit-attest's existing OpenTimestampsProvider (already fetch-based, no npm OTS dep). Provider singleton is per-process. Worker runs on app mount and polls every 5 minutes while the app is open; pauses when navigator.onLine is false, resumes on the online event. State persists in IndexedDB so pending work survives reloads.",
};
