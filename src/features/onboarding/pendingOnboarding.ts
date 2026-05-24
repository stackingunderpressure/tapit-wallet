// Module-level in-memory holder for the volatile bundle captured
// during the Fresh compose-before-login onboarding (Cut 5 of the
// 2026-05-24 Fresh young-adult-friendly theme + IA roadmap).
//
// Why module-level. The 90-second flow inverts the existing
// auth-then-wallet ceremony: the operator types a sentence (and
// optionally picks a photo), chooses a display name, chooses a
// passphrase, and acknowledges the recovery primer BEFORE
// supabase().auth.verifyOtp resolves. Once the session flips to
// signed-in, FreshOnboarding unmounts and WalletProvider mounts.
// The captured bundle needs to survive that unmount-remount handoff
// long enough for WalletProvider to consume it on first-login.
//
// Why NOT localStorage / sessionStorage / IndexedDB. The bundle
// includes the operator's passphrase. CLAUDE_ROOT.md non-negotiable
// #1: "the user's keys never leave the wallet unencrypted ... not
// in transit, not in a database column, not in storage." The
// passphrase decrypts the keypair, so the same rule applies to it.
// Module-level memory is lost the instant the tab closes or the
// page reloads — that is the desired property. If the operator
// reloads mid-onboarding, they restart. No persisted trail.

export interface OnboardingBundle {
  /** Free-text body of the first journal entry. May be empty if
   *  the operator only attached a photo. */
  text: string;
  /**
   * Optional image File the operator picked during the compose
   * step. Already normalized to a browser-renderable format by
   * the picker so the post-sign-in createJournalEntry call does
   * not need to redo it.
   */
  attachment: File | null;
  /** The display name the operator chose for their identity. */
  displayName: string;
  /**
   * The passphrase the operator chose. Used once to create the
   * encrypted wallet snapshot and immediately discarded from
   * this holder; ends up in WalletProvider's passphraseRef
   * (live in-memory only, per the existing pattern) so future
   * saves can re-encrypt.
   */
  passphrase: string;
}

let pending: OnboardingBundle | null = null;

/**
 * Stash the captured bundle for WalletProvider to consume. Called
 * by FreshOnboarding immediately before supabase().auth.verifyOtp
 * so a fast onAuthStateChange callback finds the bundle already
 * in place when WalletProvider mounts.
 */
export function setPendingOnboarding(bundle: OnboardingBundle): void {
  pending = bundle;
}

/**
 * Read the bundle without removing it. Used by WalletProvider's
 * initial-phase decider — if a bundle is present when the stored
 * blob is null, the provider transitions to onboarding-setup
 * instead of first-login.
 */
export function peekPendingOnboarding(): OnboardingBundle | null {
  return pending;
}

/**
 * Consume the bundle — read AND clear in one call. Used by the
 * onboarding-setup effect so the bundle cannot accidentally be
 * re-applied (e.g. under React StrictMode's double-invocation in
 * development).
 */
export function consumePendingOnboarding(): OnboardingBundle | null {
  const out = pending;
  pending = null;
  return out;
}

/**
 * Discard the bundle explicitly. Called when the operator backs
 * out of onboarding (e.g. closes the tab on the recovery primer)
 * or when sign-in fails and the bundle should not survive the
 * retry path.
 */
export function clearPendingOnboarding(): void {
  pending = null;
}
