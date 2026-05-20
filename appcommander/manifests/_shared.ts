/**
 * Shared FeatureManifest type for this app's feature stubs. Mirrors
 * AppCommander's contract — every feature folder will eventually
 * move its manifest into src/features/<slug>/manifest.ts once it
 * has real code; until then these stubs document intent.
 */

export type FeatureTier = 'load-bearing' | 'monetizable' | 'optional';

export interface FeatureManifest {
  slug: string;
  born: string;
  purpose: string;
  touches: string[];
  depends_on: string[];
  pause_safe: boolean;
  removal_safe: boolean;
  monetizable: boolean;
  notes?: string;
}
