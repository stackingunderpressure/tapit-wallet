import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'theme',
  born: '2026-05-24',
  purpose:
    'Theme presentation layer. Switches the wallet between Classic and Fresh surfaces via a single <html data-theme> attribute. Same cryptographic core, same envelope kinds, same routes — only the visual register changes. Foundation cut for the Fresh young-adult-friendly roadmap.',
  touches: [
    'src/features/theme/manifest.ts',
    'src/features/theme/useTheme.ts',
    'src/features/theme/applyTheme.ts',
    'src/features/theme/deviceTheme.ts',
    'src/features/theme/useDeviceTheme.ts',
    'src/features/theme/FreshLoginShell.tsx',
    'src/main.tsx',
    'tailwind.config.ts',
    'src/index.css',
  ],
  depends_on: ['storage', 'wallet-core', 'auth'],
  pause_safe: true,
  removal_safe: false,
  monetizable: false,
  notes:
    'Pause-safe because Classic stays the default — removing the toggle leaves every wallet on Classic. Not removal-safe because the prefs.theme field is part of the prefs schema once shipped; later cuts (Stories carousel, Fresh shell, Fresh onboarding) consume this hook to gate Fresh-specific rendering.',
};
