import type { FeatureManifest } from './shared/lib/manifest.ts';

import { manifest as auth } from './features/auth/manifest.ts';
import { manifest as walletCore } from './features/wallet-core/manifest.ts';
import { manifest as storage } from './features/storage/manifest.ts';
import { manifest as settings } from './features/settings/manifest.ts';
import { manifest as journal } from './features/journal/manifest.ts';
import { manifest as anchoring } from './features/anchoring/manifest.ts';
import { manifest as cosigning } from './features/cosigning/manifest.ts';
import { manifest as signRequest } from './features/sign-request/manifest.ts';
import { manifest as disclosure } from './features/disclosure/manifest.ts';
import { manifest as qr } from './features/qr/manifest.ts';
import { manifest as capture } from './features/capture/manifest.ts';
import { manifest as connections } from './features/connections/manifest.ts';
import { manifest as transport } from './features/transport/manifest.ts';
import { manifest as presence } from './features/presence/manifest.ts';
import { manifest as recovery } from './features/recovery/manifest.ts';
import { manifest as theme } from './features/theme/manifest.ts';
import { manifest as onboarding } from './features/onboarding/manifest.ts';

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
  disclosure,
  qr,
  capture,
  connections,
  transport,
  presence,
  recovery,
  theme,
  onboarding,
  persona,
  snapshotBuilder,
  suggestedQuestions,
  temporal,
];
