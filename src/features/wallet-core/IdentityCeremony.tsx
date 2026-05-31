import { useState } from 'react';
import { FOUNDING_DECLARATION, type IdentityInput } from './createIdentityAttestation.ts';
import {
  enrollPasskey,
  webauthnSupported,
  type EnrollResult,
} from '../presence/webauthn.ts';
import { SignOutEscape } from './SignOutEscape.tsx';

interface Props {
  /** The wallet's public key — needed as the WebAuthn user.id when the
   *  operator opts into binding a device passkey during the ceremony. */
  walletPubkey: string;
  onComplete: (input: IdentityInput, passkeyEnroll?: EnrollResult) => Promise<void>;
}

// The birth-of-identity ceremony. Walks the person through four
// screens that treat the moment as what it is — the founding of a
// sovereign identity, with a real responsibility attached.
//
// Steps: welcome (what is happening and what it means) → name
// (display name + optional full name) → bind (optional Face ID /
// Touch ID enrollment that makes this device's biometric authority
// part of the identity from Day One; skippable for devices without
// WebAuthn or operators who prefer to add it later) → declaration
// (read and affirm a founding statement that gets signed into the
// record) → signing (the wallet signs the identity attestation
// PLUS, if enrolled, the device-passkey credential together so the
// operator's record begins already containing both).
//
// The declaration is signed as a leaf on the identity attestation,
// so the person did not just tap through — they signed a statement.
// The device-passkey credential is a separate envelope signed under
// the same wallet key at the same moment; identity stays device-
// independent (so it survives recovery on a new device) but the
// FIRST device's biometric authority is recorded as the operator's
// first held credential. New devices enroll their own passkey via
// Mark presence later.

type Step = 'welcome' | 'name' | 'bind' | 'declaration' | 'signing';

export function IdentityCeremony({ walletPubkey, onComplete }: Props) {
  const [step, setStep] = useState<Step>('welcome');
  const [displayName, setDisplayName] = useState('');
  const [fullName, setFullName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [location, setLocation] = useState('');
  const [affirmed, setAffirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrollBusy, setEnrollBusy] = useState(false);
  const [passkeyEnroll, setPasskeyEnroll] = useState<EnrollResult | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const platformSupported = webauthnSupported();

  function goName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (trimmed.length === 0) {
      setError('Choose what people should call you.');
      return;
    }
    setError(null);
    setStep('bind');
  }

  async function bindFaceId() {
    setEnrollBusy(true);
    setEnrollError(null);
    try {
      const name = displayName.trim() || 'Tapit Wallet';
      const result = await enrollPasskey(walletPubkey, name);
      setPasskeyEnroll(result);
    } catch (err) {
      setEnrollError(err instanceof Error ? err.message : 'Enrollment failed.');
    } finally {
      setEnrollBusy(false);
    }
  }

  async function sign() {
    if (!affirmed) {
      setError('Affirm the declaration to continue.');
      return;
    }
    setError(null);
    setStep('signing');
    try {
      await onComplete(
        {
          displayName: displayName.trim(),
          fullName: fullName.trim() || undefined,
          birthday: birthday.trim() || undefined,
          location: location.trim() || undefined,
          declaration: FOUNDING_DECLARATION,
        },
        passkeyEnroll ?? undefined,
      );
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
              Step 1 of 4
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
            {/* Escape so the identity ceremony is never a dead-end —
                an operator who reached it on the wrong email account
                can sign out instead of being forced to mint an identity. */}
            <SignOutEscape label="Wrong account? Sign out and use a different email" />
          </>
        )}

        {step === 'name' && (
          <form onSubmit={goName}>
            <div className="text-xs uppercase tracking-wide text-accent">
              Step 2 of 4
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
            <label className="mt-3 block">
              <span className="text-sm font-medium">
                Birthday{' '}
                <span className="text-muted font-normal">(optional)</span>
              </span>
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              <span className="mt-1 block text-xs text-muted">
                Stored as its own leaf — a future disclosure proof can reveal
                just "over 21" without exposing the full date.
              </span>
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-medium">
                Location{' '}
                <span className="text-muted font-normal">(optional)</span>
              </span>
              <input
                type="text"
                maxLength={80}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="City, state, region — your choice of granularity"
              />
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

        {step === 'bind' && (
          <>
            <div className="text-xs uppercase tracking-wide text-accent">
              Step 3 of 4
            </div>
            <h1 className="mt-2 text-2xl font-semibold">
              Bind your Face ID
            </h1>
            <p className="mt-2 text-sm text-muted">
              Optional but recommended. Binding this device's Face ID or
              Touch ID to your identity right now means your record begins
              with a biometric proof attached — every time you sign
              something with this device the wallet can prove a human with
              your face was holding it. You can add or change this later;
              new devices enroll their own.
            </p>

            {!platformSupported && (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                This browser does not expose biometric authenticators. You
                can continue without binding now and add a passkey from a
                supported browser later.
              </div>
            )}

            {passkeyEnroll && (
              <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                ✓ Bound. This device's authenticator will be recorded as the
                first credential held by your identity the moment you sign
                below.
              </div>
            )}

            {!passkeyEnroll && enrollError && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {enrollError}
              </p>
            )}

            <div className="mt-6 flex gap-2">
              {!passkeyEnroll && platformSupported && (
                <button
                  type="button"
                  onClick={() => void bindFaceId()}
                  disabled={enrollBusy}
                  className="flex-1 rounded-md bg-ink py-3 text-paper font-medium disabled:opacity-40"
                >
                  {enrollBusy ? 'Waiting for your face…' : 'Bind now'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setStep('declaration')}
                className={
                  passkeyEnroll || !platformSupported
                    ? 'flex-1 rounded-md bg-ink py-3 text-paper font-medium'
                    : 'rounded-md border border-ink/15 px-4 text-sm'
                }
              >
                {passkeyEnroll
                  ? 'Continue'
                  : platformSupported
                    ? 'Skip for now'
                    : 'Continue without binding'}
              </button>
              <button
                type="button"
                onClick={() => setStep('name')}
                className="rounded-md border border-ink/15 px-4 text-sm"
              >
                Back
              </button>
            </div>
          </>
        )}

        {step === 'declaration' && (
          <>
            <div className="text-xs uppercase tracking-wide text-accent">
              Step 4 of 4
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
            {passkeyEnroll && (
              <p className="mt-3 text-xs text-muted">
                Signing also commits the device-passkey credential you bound
                in the previous step.
              </p>
            )}
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
                onClick={() => setStep('bind')}
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
              The wallet is signing your founding attestation
              {passkeyEnroll ? ' and your device-passkey credential' : ''} and
              anchoring it. This takes a moment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
