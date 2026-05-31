import { lazy, Suspense, useState } from 'react';
import type { Wallet } from 'tapit-attest';
import type { AnyEncryptedBlob } from '../storage/localStore.ts';

const RecoveryInitiatorModal = lazy(() =>
  import('../recovery/RecoveryInitiatorModal.tsx').then((m) => ({
    default: m.RecoveryInitiatorModal,
  })),
);
const RecoveryKeyImportModal = lazy(() =>
  import('../recovery/RecoveryKeyImportModal.tsx').then((m) => ({
    default: m.RecoveryKeyImportModal,
  })),
);

interface Props {
  onSubmit: (passphrase: string) => Promise<void>;
  ownerId: string;
  storedBlob: AnyEncryptedBlob;
  relays: readonly string[];
  onRecovered: (wallet: Wallet, passphrase: string) => Promise<void>;
  /**
   * Escape hatch: sign out of the email account this device is bound to
   * and return to the login screen. Without this the unlock screen is a
   * dead-end — an operator who does not have THIS account's passphrase
   * (e.g. landed on the wrong account, or wants to sign in as someone
   * else) has no way off the screen but the exact passphrase or a
   * recovery ceremony (operator field-test 2026-05-31: "no place to
   * send a new link or log out, if you can't get in you're stuck").
   */
  onSignOut: () => Promise<void>;
}

// Returning-user passphrase prompt. Single field. The unlock failure
// message comes from unlockWallet so the user gets a stable retry
// flow without leaking internal cipher errors.
//
// Phase 5e-v adds the "Lost passphrase? Start recovery" entry point.
// Opens the RecoveryInitiatorModal which owns the ceremony Wallet,
// the ephemeral NostrTransport, and the combine + restore + save
// choreography. The modal closes back to this prompt on cancel; on
// successful recovery it calls onRecovered which transitions the
// WalletProvider to the unlocked phase with the restored wallet.
export function UnlockPrompt({ onSubmit, ownerId, storedBlob, relays, onRecovered, onSignOut }: Props) {
  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [showKeyImport, setShowKeyImport] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    setError(null);
    try {
      await onSignOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign out.');
      setSigningOut(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(pass);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
      setPass('');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <h1 className="text-xl font-semibold">Unlock your wallet</h1>
        <p className="mt-1 text-sm text-muted">
          Enter the passphrase you set when you created this wallet.
        </p>
        <label className="mt-6 block">
          <span className="text-sm font-medium">Passphrase</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            autoFocus
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>
        <button
          type="submit"
          disabled={busy || pass.length === 0}
          className="mt-4 w-full rounded-md bg-ink py-3 text-paper font-medium disabled:opacity-40"
        >
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="mt-6 space-y-2 text-center">
          <button
            type="button"
            onClick={() => setShowRecovery(true)}
            className="block w-full text-sm text-muted hover:text-ink underline-offset-2 hover:underline"
          >
            Lost your passphrase? Start recovery with your cohort
          </button>
          <button
            type="button"
            onClick={() => setShowKeyImport(true)}
            className="block w-full text-xs text-muted hover:text-ink underline-offset-2 hover:underline"
          >
            Or use your written-down recovery key
          </button>
        </div>

        {/* Escape hatch so the unlock screen is never a dead-end: sign
            out of this email account and return to the login screen to
            sign in with a different email. The local encrypted snapshot
            is untouched — signing back in with the original email
            restores it. Separated by a divider and de-emphasized so it
            reads as the last resort it is. */}
        <div className="my-6 h-px bg-ink/10" />
        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={signingOut || busy}
          className="block w-full text-center text-sm text-muted hover:text-ink underline-offset-2 hover:underline disabled:opacity-40"
        >
          {signingOut
            ? 'Signing out…'
            : 'Not your wallet? Sign out and use a different email'}
        </button>
      </form>

      {showRecovery && (
        <Suspense fallback={null}>
          <RecoveryInitiatorModal
            ownerId={ownerId}
            storedBlob={storedBlob}
            relays={relays}
            onRecovered={onRecovered}
            onClose={() => setShowRecovery(false)}
          />
        </Suspense>
      )}

      {showKeyImport && (
        <Suspense fallback={null}>
          <RecoveryKeyImportModal
            ownerId={ownerId}
            storedBlob={storedBlob}
            onRecovered={onRecovered}
            onClose={() => setShowKeyImport(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
