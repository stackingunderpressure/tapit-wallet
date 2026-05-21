import type { FeatureManifest } from './shared/lib/manifest.ts';

import { manifest as auth } from './features/auth/manifest.ts';
import { manifest as walletCore } from './features/wallet-core/manifest.ts';
import { manifest as storage } from './features/storage/manifest.ts';
import { manifest as settings } from './features/settings/manifest.ts';
import { manifest as journal } from './features/journal/manifest.ts';
import { manifest as anchoring } from './features/anchoring/manifest.ts';
import { manifest as cosigning } from './features/cosigning/manifest.ts';
import { manifest as signRequest } from './features/sign-request/manifest.ts';

// Dormant scaffolding — paused until the Phase 7+ wallet-bot launch
// session brings the bot online.
import { manifest as persona } from './features/persona/manifest.ts';
import { manifest as snapshotBuilder } from './features/snapshot-builder/manifest.ts';
import { manifest as suggestedQuestions } from './features/suggested-questions/manifest.ts';
import { manifest as temporal } from './features/temporal/manifest.ts';

export const features: readonly FeatureManifest[] = [
  auth,
  walletCore,
  storage,
  settings,
  journal,
  anchoring,
  cosigning,
  signRequest,
  persona,
  snapshotBuilder,
  suggestedQuestions,
  temporal,
];
