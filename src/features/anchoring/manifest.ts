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
    'src/features/anchoring/hex.ts',
  ],
  depends_on: ['wallet-core', 'storage'],
  pause_safe: false,
  removal_safe: false,
  monetizable: false,
  notes:
    "Uses tapit-attest's existing OpenTimestampsProvider (already fetch-based, no npm OTS dep). Provider singleton is per-process. Worker runs on app mount and polls every 5 minutes while the app is open; pauses when navigator.onLine is false, resumes on the online event. State persists in IndexedDB so pending work survives reloads.",
};
