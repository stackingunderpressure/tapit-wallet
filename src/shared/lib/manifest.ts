// The shape every feature manifest exports. Per CLAUDE.md manifest
// doctrine: every folder under src/features/<slug>/ MUST contain a
// manifest.ts that exports a typed FeatureManifest, and the slug
// must appear in the registry. The vitest coverage test
// (manifest-registry.test.ts) fails otherwise.

export interface FeatureManifest {
  slug: string;
  born: string;
  purpose: string;
  touches: readonly string[];
  depends_on: readonly string[];
  pause_safe: boolean;
  removal_safe: boolean;
  monetizable: boolean;
  notes?: string;
}
