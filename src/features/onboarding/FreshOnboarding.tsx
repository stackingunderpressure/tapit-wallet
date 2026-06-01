import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../shared/lib/supabase.ts';
import { normalizeImage } from '../journal/normalizeImage.ts';
import {
  clearPendingOnboarding,
  setPendingOnboarding,
} from './pendingOnboarding.ts';
import { PassphraseCommitWarnings } from '../wallet-core/PassphraseCommitWarnings.tsx';
import { parseNostrPrivateKey } from '../wallet-core/parseNostrPrivateKey.ts';
import { publicKeyFromPrivate } from 'tapit-attest';
import {
  SplashStep,
  ComposeStep,
  NameStep,
  PassphraseStep,
  EmailStep,
  CodeStep,
  ImportDiscloseStep,
  ImportEnterStep,
} from './freshOnboardingSteps.tsx';

// The Fresh compose-before-login state machine. Replaces the
// sign-in form FreshLoginShell painted in Cut 2 with the
// 90-second flow the brief specified — splash, compose, name,
// passphrase, recovery primer, email, code. Volatile bundle
// (text + attachment + name + passphrase) lives in component
// state until the operator submits the OTP code; at that moment
// the bundle moves to a module-level holder so WalletProvider
// can pick it up on first mount and run the post-sign-in
// identity-plus-first-entry ceremony.
//
// Renders only when the device-level theme is fresh AND the
// session is signed-out. Loading and signed-in cases stay in
// FreshLoginShell. Shipped as Cut 5 of the 2026-05-24 Fresh
// young-adult-friendly theme + IA roadmap.

type Step =
  | 'splash'
  | 'compose'
  | 'name'
  | 'passphrase'
  | 'passphrase-warn'
  | 'email'
  | 'code'
  | 'import-disclose'
  | 'import-enter';
type EmailStatus = 'idle' | 'busy' | 'error';

const SPLASH_MS = 3000;

export function FreshOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('splash');
  // 'onboard' = the compose-first new-user flow (default). 'signin' =
  // a RETURNING operator who already has a wallet and just needs to
  // re-authenticate (session expired, new device, signed out). Before
  // this, the only sign-in path was walking the entire new-user
  // gauntlet, which dumped returning users into onboarding as if they
  // were new — operator field-test 2026-05-31: "there's no login old
  // wallet, it dumps you like you're a new user." In signin mode we
  // jump straight to the email step and DO NOT stash an onboarding
  // bundle, so WalletProvider lands on the unlock screen for the
  // restored wallet instead of trying to mint a fresh identity.
  const [mode, setMode] = useState<'onboard' | 'signin'>('onboard');

  function enterSignIn() {
    if (splashTimer.current !== null) {
      window.clearTimeout(splashTimer.current);
      splashTimer.current = null;
    }
    setError(null);
    setMode('signin');
    setStep('email');
  }

  // Volatile pre-sign-in bundle. React state only. Cleared on
  // unmount when the user navigates away mid-flow; cleared
  // explicitly when a sign-in attempt errors and the operator
  // backs out.
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [displayName, setDisplayName] = useState('');
  // Optional ISO date (YYYY-MM-DD). Empty string = operator
  // declined; the leaf is omitted from the identity attestation
  // and over-N Quick-share presets stay unavailable until they
  // re-issue. Captured next to displayName because the brief's
  // chip decision pairs it with the name step rather than
  // adding a fifth step.
  const [birthday, setBirthday] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  // Import-existing-nsec branch state (PLAN.md Tier 1 item 9,
  // 2026-05-29). When non-null, FreshOnboarding routes through the
  // import path and the captured private key rides in the bundle
  // for WalletProvider's onboarding-setup effect to consume.
  const [importKeyInput, setImportKeyInput] = useState('');
  const [importedPrivateKeyHex, setImportedPrivateKeyHex] = useState<string | null>(null);

  const photoRef = useRef<HTMLInputElement>(null);
  const splashTimer = useRef<number | null>(null);

  // Splash auto-advances after 3 seconds. A tap on the splash
  // surface skips ahead — the brief targets fast operators who
  // do not want to wait. Cleared on unmount and on manual skip.
  useEffect(() => {
    if (step !== 'splash') return;
    splashTimer.current = window.setTimeout(
      () => setStep('compose'),
      SPLASH_MS,
    );
    return () => {
      if (splashTimer.current !== null) {
        window.clearTimeout(splashTimer.current);
        splashTimer.current = null;
      }
    };
  }, [step]);

  // Defensive: if this component unmounts before the operator
  // completes the OTP step, clear any half-stashed bundle so a
  // later signed-in session does not pick up stale captured
  // state from a previous tab.
  useEffect(() => {
    return () => {
      clearPendingOnboarding();
    };
  }, []);

  function skipSplash() {
    if (splashTimer.current !== null) {
      window.clearTimeout(splashTimer.current);
      splashTimer.current = null;
    }
    setStep('compose');
  }

  async function onPickAttachment(file: File | null) {
    if (!file) {
      setAttachment(null);
      return;
    }
    setError(null);
    setAttachmentBusy(true);
    try {
      const normalized = await normalizeImage(file);
      setAttachment(normalized);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not read photo: ${err.message}`
          : 'Could not read photo on this device.',
      );
      setAttachment(null);
    } finally {
      setAttachmentBusy(false);
    }
  }

  function submitCompose(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStep('name');
  }

  function submitName(e: React.FormEvent) {
    e.preventDefault();
    if (displayName.trim().length === 0) {
      setError('Pick a name your record should show.');
      return;
    }
    setError(null);
    setStep('passphrase');
  }

  function submitPassphrase(e: React.FormEvent) {
    e.preventDefault();
    if (passphrase.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError('Passphrases do not match.');
      return;
    }
    setError(null);
    setStep('passphrase-warn');
  }

  function submitImportEnter(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = parseNostrPrivateKey(importKeyInput);
    if (!parsed.ok) {
      setError(parsed.reason);
      return;
    }
    setImportedPrivateKeyHex(parsed.privateKeyHex);
    setStep('name');
  }

  async function sendCode(targetEmail: string): Promise<boolean> {
    setEmailStatus('busy');
    setError(null);
    const { error: err } = await supabase().auth.signInWithOtp({
      email: targetEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (err) {
      setEmailStatus('error');
      setError(err.message);
      return false;
    }
    setEmailStatus('idle');
    return true;
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    const ok = await sendCode(email.trim());
    if (ok) setStep('code');
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setEmailStatus('busy');
    setError(null);
    // Returning-user sign-in: do NOT stash an onboarding bundle.
    // WalletProvider will find the existing encrypted snapshot and
    // land on the unlock screen for it. Stashing a bundle here would
    // make it try to mint a brand-new identity over the top.
    if (mode === 'onboard') {
      // Stash the bundle BEFORE verifyOtp so a fast
      // onAuthStateChange firing inside the same tick finds the
      // bundle already in place. WalletProvider mounts after the
      // session flips signed-in and reads the bundle on its first
      // useEffect run.
      setPendingOnboarding({
        text,
        attachment,
        displayName: displayName.trim(),
        birthday: birthday.trim() || undefined,
        passphrase,
        ...(importedPrivateKeyHex
          ? { importedPrivateKeyHex }
          : {}),
      });
    }
    const { error: err } = await supabase().auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    if (err) {
      setEmailStatus('error');
      setError(err.message);
      // Sign-in did not happen. Discard the stash so a later
      // retry re-stashes a fresh copy and an abandoned attempt
      // does not leak state.
      clearPendingOnboarding();
      return;
    }
    // Hand off to WalletProvider. Replace the history entry so
    // the back button does not bring the operator back to the
    // OTP form mid-handoff.
    navigate('/', { replace: true });
  }

  async function resend() {
    const ok = await sendCode(email.trim());
    if (ok) {
      setResent(true);
      window.setTimeout(() => setResent(false), 2500);
    }
  }

  return (
    <FreshOnboardingShell onSplashSkip={step === 'splash' ? skipSplash : null}>
      {step === 'splash' && (
        <>
          <SplashStep />
          <p className="mt-10 text-center text-sm text-fresh-text-secondary">
            Already have a wallet?{' '}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                enterSignIn();
              }}
              className="font-medium text-fresh-accent-primary underline transition hover:text-fresh-text-primary"
            >
              Sign in
            </button>
          </p>
        </>
      )}

      {step === 'compose' && (
        <>
          <ComposeStep
            text={text}
            onTextChange={setText}
            attachment={attachment}
            attachmentBusy={attachmentBusy}
            onPickAttachment={onPickAttachment}
            onClearAttachment={() => setAttachment(null)}
            photoRef={photoRef}
            onSubmit={submitCompose}
            error={error}
          />
          <p className="mt-6 text-center text-xs text-fresh-text-tertiary">
            Already have an account in another app?{' '}
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep('import-disclose');
              }}
              className="font-medium text-fresh-accent-primary underline transition hover:text-fresh-text-primary"
            >
              Import it
            </button>
          </p>
          <p className="mt-2 text-center text-xs text-fresh-text-tertiary">
            Already have a Tapit wallet?{' '}
            <button
              type="button"
              onClick={enterSignIn}
              className="font-medium text-fresh-accent-primary underline transition hover:text-fresh-text-primary"
            >
              Sign in
            </button>
          </p>
        </>
      )}

      {step === 'import-disclose' && (
        <ImportDiscloseStep
          onContinue={() => {
            setError(null);
            setStep('import-enter');
          }}
          onBack={() => {
            setError(null);
            setImportedPrivateKeyHex(null);
            setImportKeyInput('');
            setStep('compose');
          }}
        />
      )}

      {step === 'import-enter' && (
        <ImportEnterStep
          keyInput={importKeyInput}
          onKeyInputChange={setImportKeyInput}
          derivedPubkey={(() => {
            const trimmed = importKeyInput.trim();
            if (trimmed.length === 0) return null;
            const parsed = parseNostrPrivateKey(trimmed);
            if (!parsed.ok) return null;
            try {
              return publicKeyFromPrivate(parsed.privateKeyHex);
            } catch {
              return null;
            }
          })()}
          onSubmit={submitImportEnter}
          onBack={() => {
            setError(null);
            setStep('import-disclose');
          }}
          error={error}
        />
      )}

      {step === 'name' && (
        <NameStep
          displayName={displayName}
          onDisplayNameChange={setDisplayName}
          birthday={birthday}
          onBirthdayChange={setBirthday}
          onSubmit={submitName}
          onBack={() => setStep('compose')}
          error={error}
        />
      )}

      {step === 'passphrase' && (
        <PassphraseStep
          passphrase={passphrase}
          confirmPassphrase={confirmPassphrase}
          onPassphraseChange={setPassphrase}
          onConfirmChange={setConfirmPassphrase}
          onSubmit={submitPassphrase}
          onBack={() => setStep('name')}
          error={error}
        />
      )}

      {step === 'passphrase-warn' && (
        <PassphraseCommitWarnings
          variant="fresh"
          onConfirm={() => setStep('email')}
          onBack={() => setStep('passphrase')}
        />
      )}

      {step === 'email' && (
        <EmailStep
          email={email}
          onEmailChange={setEmail}
          onSubmit={submitEmail}
          onBack={() => {
            setError(null);
            if (mode === 'signin') {
              // Returning-user path has no preceding onboarding steps
              // to walk back through — return to the splash entry.
              setMode('onboard');
              setStep('splash');
            } else {
              setStep('passphrase-warn');
            }
          }}
          signInMode={mode === 'signin'}
          busy={emailStatus === 'busy'}
          error={error}
        />
      )}

      {step === 'code' && (
        <CodeStep
          email={email}
          code={code}
          onCodeChange={setCode}
          onSubmit={submitCode}
          onResend={resend}
          onChangeEmail={() => {
            setStep('email');
            setCode('');
            setError(null);
          }}
          busy={emailStatus === 'busy'}
          resent={resent}
          error={error}
        />
      )}
    </FreshOnboardingShell>
  );
}

function FreshOnboardingShell({
  children,
  onSplashSkip,
}: {
  children: React.ReactNode;
  onSplashSkip: (() => void) | null;
}) {
  return (
    <div
      className="relative min-h-screen overflow-hidden fresh-aurora-bg"
      onClick={onSplashSkip ?? undefined}
    >
      <div className="relative mx-auto max-w-md px-5 py-8">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-2 w-2 rounded-full bg-fresh-accent-primary shadow-[0_0_18px_rgba(192,252,77,0.7)]"
            />
            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-fresh-text-primary">
              Tapit Wallet
            </span>
          </div>
          <Link
            to="/about"
            className="text-xs text-fresh-text-tertiary hover:text-fresh-text-primary transition"
            onClick={(e) => e.stopPropagation()}
          >
            What is this? →
          </Link>
        </header>
        <main className="animate-fresh-rise motion-reduce:animate-none">
          {children}
        </main>
      </div>
    </div>
  );
}

