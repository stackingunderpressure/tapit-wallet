import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'persona',
  born: '2026-05-18',
  purpose:
    'Dormant. Bot persona scaffolding inherited from the assistant-bot chassis part. Not wired into v1; activated by the Phase 7+ wallet-bot launch session.',
  touches: [
    'src/features/persona/types.ts',
    'supabase/functions/_shared/persona.ts',
  ],
  depends_on: [],
  pause_safe: true,
  removal_safe: true,
  monetizable: false,
  notes:
    'Pair with supabase/functions/_shared/persona.ts under the PFOR-027 parity contract (src/shared/persona-contract.test.ts).',
};
