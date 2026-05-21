import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'snapshot-builder',
  born: '2026-05-18',
  purpose:
    'Dormant. Bot conversation-snapshot scaffolding inherited from the assistant-bot chassis part. Not wired into v1; activated by the Phase 7+ wallet-bot launch session.',
  touches: ['src/features/snapshot-builder/types.ts'],
  depends_on: [],
  pause_safe: true,
  removal_safe: true,
  monetizable: false,
};
