import type { Wallet } from 'tapit-attest';
import {
  createIdentityAttestation,
  FOUNDING_DECLARATION,
} from '../wallet-core/createIdentityAttestation.ts';
import { createJournalEntry } from '../journal/createJournalEntry.ts';
import { saveWallet } from '../wallet-core/saveWallet.ts';
import type { WorkerHandle } from '../anchoring/anchorWorker.ts';
import type { OnboardingBundle } from './pendingOnboarding.ts';

// Post-sign-in handoff. Takes the volatile bundle the operator
// captured during the compose-before-login flow and applies it to
// the freshly-created Wallet: signs the founding identity
// attestation with the captured display name + the founding
// declaration, then (if the operator wrote something or attached
// a photo) signs the first journal entry as well, then encrypts
// + persists the snapshot under the captured passphrase.
//
// This is the moment of magic the brief promised — the first
// signed entry exists in the wallet by the time login completes.
// The operator never sees a PassphrasePrompt or an IdentityCeremony
// during Fresh onboarding because they have already answered every
// question those screens ask.
//
// Same primitives as the Classic IdentityCeremony+JournalComposer
// path. No new envelope kinds, no new signing math — Cut 5 is
// presentation-layer surgery, not crypto-layer.
export async function applyOnboardingBundle(
  wallet: Wallet,
  ownerId: string,
  worker: WorkerHandle | null,
  bundle: OnboardingBundle,
  cloudSync: boolean,
): Promise<void> {
  // Founding identity — same shape the IdentityCeremony produces
  // for Classic. Display name comes from the operator's name step;
  // declaration is the same FOUNDING_DECLARATION every Tapit
  // identity is born with.
  await createIdentityAttestation(wallet, {
    displayName: bundle.displayName,
    declaration: FOUNDING_DECLARATION,
    birthday: bundle.birthday,
  });

  // First journal entry — only if the operator actually composed
  // something. An empty text + no attachment means the operator
  // skipped the compose step (e.g. tapped through the splash and
  // headed straight to sign-in); in that case the wallet still
  // ships with its identity attestation but no first entry. The
  // home screen's empty state handles that gracefully.
  const hasContent =
    bundle.text.trim().length > 0 || bundle.attachment !== null;
  if (hasContent) {
    await createJournalEntry(
      wallet,
      ownerId,
      bundle.passphrase,
      worker,
      {
        text: bundle.text.trim() || 'First moment.',
        // Default category for the compose-first capture. The
        // operator can re-categorize from the entry detail later
        // if they want; the brief deliberately does NOT ask for a
        // category during the 90-second flow.
        category: 'Diary',
        subject: wallet.identity,
        attachment: bundle.attachment ?? undefined,
      },
      cloudSync,
    );
  }

  // Persist the snapshot. The identity and (optional) first entry
  // are now in the wallet's in-memory holdings; saveWallet
  // re-exports under the captured passphrase and writes to both
  // IndexedDB and (when cloudSync is on) Supabase as ciphertext.
  await saveWallet(wallet, bundle.passphrase, ownerId);
}
