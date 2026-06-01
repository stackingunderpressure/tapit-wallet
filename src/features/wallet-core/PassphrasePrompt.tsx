import { lazy, Suspense, useState } from 'react';
import { PassphraseCommitWarnings } from './PassphraseCommitWarnings.tsx';
import { SignOutEscape } from './SignOutEscape.tsx';

// Lazy-loaded so the import-existing-nsec substrate (bech32 codec,
// publicKeyFromPrivate, the disclose + enter + confirm UI) stays
// out of the first-login critical-path bundle. Most operators
// generate fresh; only those who tap the import link pay the
// chunk-load cost. Same pattern as WalletGuideBitcoinTab.
const ImportNostrIdentityPrompt = lazy(() =>
  import('./ImportNostrIdentityPrompt.tsx').then((m) => ({
    default: m.ImportNostrIdentityPrompt,
  })),
);

interface Props {
  onSubmit: (passphrase: string) => Promise<void>;
  /** Import an existing Nostr nsec instead of generating a fresh keypair. */
  onImport?: (passphrase: string, privateKeyHex: string) => Promise<void>;
}

// First-login passphrase capture. Two fields with confirmation. The
// form-submit ONLY validates field-match + minimum length — actual
// wallet creation is gated behind PassphraseCommitWarnings (the
// two-step personal-and-memorable + irrecoverable-consequence gate
// added 2026-05-27 after the operator flagged the password-manager
// clickthrough failure mode). The passphrase IS the encryption key
// per CLAUDE_ROOT.md rule one; a clickthrough mistake is terminal
// because the cloud-sync blob is undecryptable without it.
//
// Operators with an existing Nostr identity can switch to the
// import-existing-nsec flow via the link below the form (PLAN.md
// Tier 1 item 9, 2026-05-29). The import path runs through its own
// disclosure-and-warning gate before committing the imported key.
export function PassphrasePrompt({ onSubmit, onImport }: Props) {
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [importMode, setImportMode] = useState(false);

  if (importMode && onImport) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center p-6 text-muted text-sm">
            Loading import flow…
          </div>
        }
      >
        <ImportNostrIdentityPrompt
          onSubmit={onImport}
          onCancel={() => setImportMode(false)}
        />
      </Suspense>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pass !== confirm) {
      setError('Passphrases do not match.');
      return;
    }
    if (pass.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    setError(null);
    setWarningsOpen(true);
  }

  async function commit() {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(pass);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
      setWarningsOpen(false);
    }
  }

  if (warningsOpen) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <PassphraseCommitWarnings
          variant="classic"
          busy={busy}
          error={error}
          onConfirm={commit}
          onBack={() => setWarningsOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <h1 className="text-xl font-semibold">Pick a passphrase only you would know</h1>
        <p className="mt-1 text-sm text-muted">
          Your wallet is encrypted under this passphrase. Pick something
          personal to you — a phrase you would remember on your own. Password
          managers are fine for backup, but the passphrase needs to live in
          your head first, not just in an autofill box.
        </p>
        <label className="mt-6 block">
          <span className="text-sm font-medium">Passphrase</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>
        <label className="mt-3 block">
          <span className="text-sm font-medium">Confirm passphrase</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>
        <button
          type="submit"
          className="mt-4 w-full rounded-md bg-ink py-3 text-paper font-medium"
        >
          Continue
        </button>
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {onImport && (
          <p className="mt-5 text-center text-xs text-muted">
            Already have an account in another app?{' '}
            <button
              type="button"
              onClick={() => setImportMode(true)}
              className="text-accent underline hover:text-ink"
            >
              Import your existing identity
            </button>
          </p>
        )}
        {/* Escape so first-login is never a dead-end if the operator
            landed on the wrong email account. Wording avoids "your
            wallet" since none exists for this account yet. */}
        <SignOutEscape label="Wrong account? Sign out and use a different email" />
      </form>
    </div>
  );
}
