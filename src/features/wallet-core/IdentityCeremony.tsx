import { useState } from 'react';
import { FOUNDING_DECLARATION, type IdentityInput } from './createIdentityAttestation.ts';

interface Props {
  onComplete: (input: IdentityInput) => Promise<void>;
}

// The birth-of-identity ceremony. The first-run flow used to be a
// single bare display-name field; this walks the person through
// four screens that treat the moment as what it is — the founding
// of a sovereign identity, with a real responsibility attached.
//
// Steps: welcome (what is happening and what it means) → name
// (display name + optional full name) → declaration (read and
// affirm a founding statement that gets signed into the record) →
// signing (the wallet signs; a brief acknowledgement). The
// declaration is signed as a leaf on the identity attestation, so
// the person did not just tap through — they signed a statement.

type Step = 'welcome' | 'name' | 'declaration' | 'signing';

export function IdentityCeremony({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('welcome');
  const [displayName, setDisplayName] = useState('');
  const [fullName, setFullName] = useState('');
  const [affirmed, setAffirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function goName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (trimmed.length === 0) {
      setError('Choose what people should call you.');
      return;
    }
    setError(null);
    setStep('declaration');
  }

  async function sign() {
    if (!affirmed) {
      setError('Affirm the declaration to continue.');
      return;
    }
    setError(null);
    setStep('signing');
    try {
      await onComplete({
        displayName: displayName.trim(),
        fullName: fullName.trim() || undefined,
        declaration: FOUNDING_DECLARATION,
      });
      // onComplete transitions the wallet out of the ceremony; this
      // component unmounts. No further state needed.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setStep('declaration');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {step === 'welcome' && (
          <>
            <div className="text-xs uppercase tracking-wide text-accent">
              Step 1 of 3
            </div>
            <h1 className="mt-2 text-2xl font-semibold">
              Your identity is being born
            </h1>
            <div className="mt-4 space-y-3 text-sm text-ink/80">
              <p>
                A moment ago this wallet generated a keypair that exists
                nowhere else in the world. It is yours. No company holds a
                copy. No server can take it away.
              </p>
              <p>
                From here on, the record of your verifiable life — what you
                do, who vouches for you, what you witness — grows from this
                one root.
              </p>
              <p>
                That also means the responsibility is yours. The keys live on
                this device, encrypted by your passphrase. Keep the
                passphrase. Make a backup. The wallet will help, but the
                sovereignty is real, and so is the duty.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep('name')}
              className="mt-6 w-full rounded-md bg-ink py-3 text-paper font-medium"
            >
              Begin
            </button>
          </>
        )}

        {step === 'name' && (
          <form onSubmit={goName}>
            <div className="text-xs uppercase tracking-wide text-accent">
              Step 2 of 3
            </div>
            <h1 className="mt-2 text-2xl font-semibold">Your name</h1>
            <p className="mt-2 text-sm text-muted">
              This becomes the first thing your identity says about itself —
              a signed, dated declaration of who you are. You can share it
              later or keep it private; the wallet holds the full record
              either way.
            </p>
            <label className="mt-5 block">
              <span className="text-sm font-medium">
                What people call you
              </span>
              <input
                type="text"
                required
                autoComplete="name"
                autoFocus
                maxLength={64}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="Ada"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-medium">
                Full name{' '}
                <span className="text-muted font-normal">(optional)</span>
              </span>
              <input
                type="text"
                autoComplete="name"
                maxLength={120}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="Ada Lovelace"
              />
              <span className="mt-1 block text-xs text-muted">
                Your full legal name, if you want it on the founding record.
              </span>
            </label>
            <div className="mt-6 flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-md bg-ink py-3 text-paper font-medium"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => setStep('welcome')}
                className="rounded-md border border-ink/15 px-4 text-sm"
              >
                Back
              </button>
            </div>
            {error && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
          </form>
        )}

        {step === 'declaration' && (
          <>
            <div className="text-xs uppercase tracking-wide text-accent">
              Step 3 of 3
            </div>
            <h1 className="mt-2 text-2xl font-semibold">
              Your founding declaration
            </h1>
            <p className="mt-2 text-sm text-muted">
              Every identity in this wallet begins with a statement the
              person signs themselves. Read it. If it is true, affirm it —
              your signature makes it a permanent part of your record.
            </p>
            <blockquote className="mt-4 rounded-md border-l-2 border-accent bg-white px-4 py-3 text-sm italic">
              {FOUNDING_DECLARATION}
            </blockquote>
            <label className="mt-4 flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={affirmed}
                onChange={(e) => setAffirmed(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm">
                I have read this declaration and I affirm it.
              </span>
            </label>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={sign}
                disabled={!affirmed}
                className="flex-1 rounded-md bg-ink py-3 text-paper font-medium disabled:opacity-40"
              >
                Sign my identity
              </button>
              <button
                type="button"
                onClick={() => setStep('name')}
                className="rounded-md border border-ink/15 px-4 text-sm"
              >
                Back
              </button>
            </div>
            {error && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
          </>
        )}

        {step === 'signing' && (
          <div className="text-center">
            <h1 className="text-2xl font-semibold">Signing your identity…</h1>
            <p className="mt-2 text-sm text-muted">
              The wallet is signing your founding attestation and anchoring
              it. This takes a moment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
