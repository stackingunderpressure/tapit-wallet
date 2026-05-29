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
              Bring your existing Nostr identity in
            </h1>
            <p className="mt-3 text-sm text-muted">
              You can import a Nostr nsec you already use somewhere else
              (Primal, Damus, Amethyst, an nsec-bunker). Your existing
              follows, profile, and post history come with you. Tapit's
              signed-attestation substrate then decorates the identity
              you already have rather than starting you fresh.
            </p>
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
              <p className="font-semibold">Read this before you continue.</p>
              <p className="mt-2">
                For a fresh Tapit identity, your private key never leaves
                this wallet unencrypted — that is rule one. For an
                IMPORTED identity, that rule becomes more nuanced because
                your nsec already exists outside Tapit (in whichever client
                you have been using). Tapit holds an encrypted local copy;
                the original copy lives wherever you have used it.
              </p>
              <p className="mt-2">
                You are making an informed tradeoff: continuity of your
                existing Nostr identity in exchange for the keys-never-
                leave-the-wallet discipline being weakened for this one
                key. Pick fresh-generate if that tradeoff is not worth it
                to you.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep('enter')}
              className="mt-5 w-full rounded-md bg-ink py-3 text-paper font-medium"
            >
              I understand — import my existing identity
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="mt-2 w-full rounded-md border border-ink/15 bg-white py-3 text-sm font-medium"
            >
              Generate a fresh identity instead
            </button>
          </>
        )}

        {step === 'enter' && (
          <form onSubmit={onEnterSubmit}>
            <h1 className="text-xl font-semibold">Paste your Nostr nsec</h1>
            <p className="mt-2 text-sm text-muted">
              Paste your nsec (nsec1…) or your 64-character hex private
              key. The pubkey we derive shows below so you can verify
              before continuing.
            </p>
            <label className="mt-4 block">
              <span className="text-sm font-medium">Private key</span>
              <input
                type="password"
                required
                autoFocus
                autoComplete="off"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="nsec1… or 64-char hex"
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono focus:border-accent focus:outline-none"
              />
            </label>
            {livePubkey && (
              <div className="mt-3 rounded-md bg-ink/[0.04] px-3 py-2 text-xs">
                <div className="text-muted">Derived pubkey:</div>
                <div className="mt-1 font-mono break-all text-ink">
                  {livePubkey}
                </div>
                <div className="mt-1 text-muted">
                  Verify this matches the pubkey of the Nostr identity
                  you intend to import.
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
              Tapit needs a passphrase to encrypt the local copy of your
              imported identity. This is a NEW passphrase — not your
              other Nostr client's passphrase, just the one Tapit uses
              to encrypt the snapshot it stores on this device. Pick
              something personal you would remember on your own.
            </p>
            <div className="mt-3 rounded-md bg-ink/[0.04] px-3 py-2 text-xs">
              <div className="text-muted">Importing identity:</div>
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
