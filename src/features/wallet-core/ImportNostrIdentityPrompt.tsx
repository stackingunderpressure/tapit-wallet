import { useMemo, useState } from 'react';
import { publicKeyFromPrivate } from 'tapit-attest';
import { parseNostrPrivateKey } from './parseNostrPrivateKey.ts';
import { PassphraseCommitWarnings } from './PassphraseCommitWarnings.tsx';

// Classic import-existing-nsec flow (PLAN.md Tier 1 item 9). Three
// steps: disclose the keys-discipline tradeoff plainly, capture
// the nsec and confirm the derived pubkey, capture a passphrase
// for the LOCAL ENCRYPTED COPY then route through the existing
// PassphraseCommitWarnings gate. The submit callback runs only
// after the operator has acknowledged the personal-and-memorable
// + irrecoverable warnings, same gate that protects fresh-identity
// passphrase commits.

interface Props {
  onSubmit: (passphrase: string, privateKeyHex: string) => Promise<void>;
  onCancel: () => void;
}

type Step = 'disclose' | 'enter' | 'passphrase';

function shortKey(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}

export function ImportNostrIdentityPrompt({ onSubmit, onCancel }: Props) {
  const [step, setStep] = useState<Step>('disclose');
  const [keyInput, setKeyInput] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [confirmedKeyHex, setConfirmedKeyHex] = useState<string | null>(null);
  const [pass, setPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [warningsOpen, setWarningsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Live-derive the pubkey from the input as the operator types so
  // they can verify before committing. Only runs when parse succeeds.
  const livePubkey = useMemo(() => {
    if (keyInput.trim().length === 0) return null;
    const parsed = parseNostrPrivateKey(keyInput);
    if (!parsed.ok) return null;
    try {
      return publicKeyFromPrivate(parsed.privateKeyHex);
    } catch {
      return null;
    }
  }, [keyInput]);

  function onEnterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setParseError(null);
    const parsed = parseNostrPrivateKey(keyInput);
    if (!parsed.ok) {
      setParseError(parsed.reason);
      return;
    }
    setConfirmedKeyHex(parsed.privateKeyHex);
    setStep('passphrase');
  }

  function onPassphraseSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (pass !== confirmPass) {
      setSubmitError('Passphrases do not match.');
      return;
    }
    if (pass.length < 8) {
      setSubmitError('Use at least 8 characters.');
      return;
    }
    setWarningsOpen(true);
  }

  async function commit() {
    if (!confirmedKeyHex) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await onSubmit(pass, confirmedKeyHex);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Import failed.');
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
          error={submitError}
          onConfirm={commit}
          onBack={() => setWarningsOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {step === 'disclose' && (
          <>
            <h1 className="text-xl font-semibold">
              Bring your existing account in
            </h1>
            <p className="mt-3 text-sm text-muted">
              If you already use an app like Primal, Damus, or Amethyst,
              you can bring that account here using its private key. Your
              existing profile, follows, and history come with you, and
              Tapit builds your signed records on top of the identity you
              already have instead of starting you over.
            </p>
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
              <p className="font-semibold">Read this before you continue.</p>
              <p className="mt-2">
                When Tapit creates a brand-new account for you, your secret
                key never leaves this device unprotected — that's the core
                rule. When you import a key from another app, that key
                already exists in that other app too, so now there are two
                copies: an encrypted one here, and the original wherever
                you've been using it.
              </p>
              <p className="mt-2">
                That's a fair trade if keeping your existing account matters
                to you — but it's a little less private than a fresh key
                made only here. Choose "start fresh" instead if that trade
                isn't worth it.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep('enter')}
              className="mt-5 w-full rounded-md bg-ink py-3 text-paper font-medium"
            >
              I understand — bring my account in
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="mt-2 w-full rounded-md border border-ink/15 bg-white py-3 text-sm font-medium"
            >
              Start fresh instead
            </button>
          </>
        )}

        {step === 'enter' && (
          <form onSubmit={onEnterSubmit}>
            <h1 className="text-xl font-semibold">Paste your account key</h1>
            <p className="mt-2 text-sm text-muted">
              Paste the private key from your other app. It usually starts
              with "nsec1…", or it may be a long string of letters and
              numbers. We'll show your public ID below so you can check it
              matches before continuing.
            </p>
            <label className="mt-4 block">
              <span className="text-sm font-medium">Account key</span>
              <input
                type="text"
                required
                autoFocus
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="nsec1… or a long string of letters and numbers"
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono focus:border-accent focus:outline-none"
              />
            </label>
            {livePubkey && (
              <div className="mt-3 rounded-md bg-ink/[0.04] px-3 py-2 text-xs">
                <div className="text-muted">Your public ID:</div>
                <div className="mt-1 font-mono break-all text-ink">
                  {livePubkey}
                </div>
                <div className="mt-1 text-muted">
                  Check this matches the account you meant to bring in.
                </div>
              </div>
            )}
            <button
              type="submit"
              disabled={!livePubkey}
              className="mt-4 w-full rounded-md bg-ink py-3 text-paper font-medium disabled:opacity-40"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => setStep('disclose')}
              className="mt-2 w-full rounded-md border border-ink/15 bg-white py-3 text-sm font-medium"
            >
              Back
            </button>
            {parseError && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {parseError}
              </p>
            )}
          </form>
        )}

        {step === 'passphrase' && confirmedKeyHex && (
          <form onSubmit={onPassphraseSubmit}>
            <h1 className="text-xl font-semibold">
              Pick a passphrase for the local copy
            </h1>
            <p className="mt-3 text-sm text-muted">
              Tapit uses a passphrase to lock the copy of your account on
              this device. This is a NEW passphrase you choose here — not a
              password from your other app. Pick something personal you'll
              remember on your own.
            </p>
            <div className="mt-3 rounded-md bg-ink/[0.04] px-3 py-2 text-xs">
              <div className="text-muted">Bringing in account:</div>
              <div className="mt-1 font-mono text-ink">
                {shortKey(publicKeyFromPrivate(confirmedKeyHex))}
              </div>
            </div>
            <label className="mt-4 block">
              <span className="text-sm font-medium">Passphrase</span>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-medium">Confirm passphrase</span>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none"
              />
            </label>
            <button
              type="submit"
              className="mt-4 w-full rounded-md bg-ink py-3 text-paper font-medium"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => setStep('enter')}
              className="mt-2 w-full rounded-md border border-ink/15 bg-white py-3 text-sm font-medium"
            >
              Back
            </button>
            {submitError && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {submitError}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
