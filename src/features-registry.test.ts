import { describe, expect, it } from 'vitest';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { features } from './features-registry.ts';

const here = dirname(fileURLToPath(import.meta.url));
const featuresDir = join(here, 'features');

function featureFolders(): string[] {
  return readdirSync(featuresDir).filter((name) =>
    statSync(join(featuresDir, name)).isDirectory(),
  );
}

describe('manifest doctrine — every feature folder is registered', () => {
  it('every src/features/* directory has a manifest.ts', () => {
    for (const slug of featureFolders()) {
      const manifestPath = join(featuresDir, slug, 'manifest.ts');
      expect(
        existsSync(manifestPath),
        `${slug} is missing a manifest.ts`,
      ).toBe(true);
    }
  });

  it('every src/features/* directory appears in the registry by slug', () => {
    const slugs = new Set(features.map((f) => f.slug));
    for (const slug of featureFolders()) {
      expect(
        slugs.has(slug),
        `feature folder "${slug}" is not in features-registry.ts`,
      ).toBe(true);
    }
  });

  it('every registry slug matches an existing feature folder', () => {
    const folders = new Set(featureFolders());
    for (const f of features) {
      expect(
        folders.has(f.slug),
        `registry slug "${f.slug}" has no matching src/features/${f.slug}/ folder`,
      ).toBe(true);
    }
  });

  it('registry slugs are unique', () => {
    const slugs = features.map((f) => f.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
