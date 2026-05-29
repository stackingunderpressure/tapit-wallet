import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../shared/lib/supabase.ts';
import { normalizeImage } from '../journal/normalizeImage.ts';
import {
  clearPendingOnboarding,
  setPendingOnboarding,
} from './pendingOnboarding.ts';
import { PassphraseCommitWarnings } from '../wallet-core/PassphraseCommitWarnings.tsx';
import {
  SplashStep,
  ComposeStep,
  NameStep,
  PassphraseStep,
  RecoveryStep,
  EmailStep,
  CodeStep,
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
  | 'recovery'
  | 'email'
  | 'code';
type EmailStatus = 'idle' | 'busy' | 'error';

const SPLASH_MS = 3000;

export function FreshOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('splash');

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

  function ackRecovery() {
    setError(null);
    setStep('email');
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
    });
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
      {step === 'splash' && <SplashStep />}

      {step === 'compose' && (
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
          onConfirm={() => setStep('recovery')}
          onBack={() => setStep('passphrase')}
        />
      )}

      {step === 'recovery' && (
        <RecoveryStep
          onAcknowledge={ackRecovery}
          onBack={() => setStep('passphrase-warn')}
        />
      )}

      {step === 'email' && (
        <EmailStep
          email={email}
          onEmailChange={setEmail}
          onSubmit={submitEmail}
          onBack={() => setStep('recovery')}
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

