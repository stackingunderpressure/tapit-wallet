/**
 * 🚦 Feature flag util — scaffolded by Frank into every new app from
 * day one so monetization gating is a one-bit flip, not a refactor.
 *
 * Three states per feature:
 *   - 'on'   — live for everyone (free, default for most P0/P1)
 *   - 'off'  — fully disabled (used for incomplete or paused
 *              features; mirrors `pause_safe: true` in the manifest)
 *   - 'paid' — gated behind paid tier (mirrors `monetizable: true`
 *              in the manifest; the runtime check resolves against
 *              the user's subscription state)
 *
 * Usage at a feature entry point:
 *
 *   import { featureFlag } from '@shared/lib/featureFlag';
 *
 *   export function BackupScreen() {
 *     const { allowed, reason } = featureFlag.check('backup-recovery');
 *     if (!allowed) return <PaywallOrDisabledShell reason={reason} />;
 *     return <BackupBody />;
 *   }
 *
 * Adding a new feature: add its slug to the FLAGS map below with a
 * default state. The default value is the source of truth until the
 * operator overrides via Settings (later phase — UI to flip flags
 * without redeploy).
 *
 * Per the chassis monetization doctrine, a flag DEFAULTS to 'on'
 * (free for everyone) even when its manifest is `monetizable: true`
 * — flipping it to 'paid' is a one-line change the operator makes
 * when they decide to charge. backup-recovery is monetizable but
 * ships 'on'.
 *
 * Subscription wiring is stubbed for v1 — every user is treated as
 * on the free tier. When the paywall ships, replace the
 * `isOnPaidTier()` body with a real subscription read.
 */

export type FlagState = 'on' | 'off' | 'paid';

export type FeatureFlagSlug =
  | 'auth'
  | 'wallet-core'
  | 'app-connections'
  | 'backup-recovery'
  | 'wallet-bot';

interface FlagCheckResult {
  allowed: boolean;
  /** Why allowed/blocked — useful for the UI to render a paywall
      vs a "this feature is paused" vs "you don't have access". */
  reason: 'on' | 'off' | 'paid_unlocked' | 'paid_locked';
}

/**
 * Default flag states. Update this map when you add a new feature.
 * `monetizable: true` in the manifest does NOT force 'paid' here —
 * the chassis doctrine says default 'on' (free) until the operator
 * decides to charge.
 */
const FLAGS: Record<FeatureFlagSlug, FlagState> = {
  auth: 'on',
  'wallet-core': 'on',
  'app-connections': 'on',
  'backup-recovery': 'on',
  'wallet-bot': 'on',
};

/**
 * Stub: returns true when the user is on a paid tier. Real
 * implementation will read from Supabase (e.g., a `subscriptions`
 * table or the auth user metadata). For now, free-for-everyone.
 */
function isOnPaidTier(): boolean {
  return false;
}

export const featureFlag = {
  /**
   * Resolve a feature's runtime state. Returns whether the calling
   * code should render its content.
   */
  check(slug: FeatureFlagSlug): FlagCheckResult {
    const state = FLAGS[slug];
    if (state === 'on') return { allowed: true, reason: 'on' };
    if (state === 'off') return { allowed: false, reason: 'off' };
    // 'paid' — check subscription
    return isOnPaidTier()
      ? { allowed: true, reason: 'paid_unlocked' }
      : { allowed: false, reason: 'paid_locked' };
  },

  /** Read raw flag state for display (e.g., Settings UI). */
  raw(slug: FeatureFlagSlug): FlagState {
    return FLAGS[slug];
  },

  /** All flag slugs — useful for Settings UI iterating over them. */
  list(): FeatureFlagSlug[] {
    return Object.keys(FLAGS) as FeatureFlagSlug[];
  },
};
