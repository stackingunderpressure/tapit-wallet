import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'temporal',
  born: '2026-05-18',
  purpose:
    'Dormant. Bot temporal-context scaffolding inherited from the assistant-bot chassis part. Not wired into v1; activated by the Phase 7+ wallet-bot launch session.',
  touches: ['src/features/temporal/temporalContext.ts'],
  depends_on: [],
  pause_safe: true,
  removal_safe: true,
  monetizable: false,
};
