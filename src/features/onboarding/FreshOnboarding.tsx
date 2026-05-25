import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../shared/lib/supabase.ts';
import { normalizeImage } from '../journal/normalizeImage.ts';
import {
  clearPendingOnboarding,
  setPendingOnboarding,
} from './pendingOnboarding.ts';

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

type Step = 'splash' | 'compose' | 'name' | 'passphrase' | 'recovery' | 'email' | 'code';
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
    setStep('recovery');
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

      {step === 'recovery' && (
        <RecoveryStep
          onAcknowledge={ackRecovery}
          onBack={() => setStep('passphrase')}
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

function SplashStep() {
  return (
    <div className="pt-12 text-center">
      <h1 className="text-fresh-hero font-fresh-display leading-[1.02] text-fresh-text-primary">
        What just happened
        <br />
        to you?
      </h1>
      <p className="mt-6 text-sm text-fresh-text-secondary">
        Tap to begin. We'll hold the record — you keep the key.
      </p>
    </div>
  );
}

function ComposeStep(props: {
  text: string;
  onTextChange: (v: string) => void;
  attachment: File | null;
  attachmentBusy: boolean;
  onPickAttachment: (f: File | null) => void;
  onClearAttachment: () => void;
  photoRef: React.RefObject<HTMLInputElement>;
  onSubmit: (e: React.FormEvent) => void;
  error: string | null;
}) {
  return (
    <form onSubmit={props.onSubmit}>
      <h1 className="text-fresh-display font-fresh-display text-fresh-text-primary">
        Something to remember.
      </h1>
      <p className="mt-3 text-sm text-fresh-text-secondary">
        Type a sentence about today, snap a photo, or both. It isn't signed
        yet — we'll make it real together.
      </p>
      <label className="mt-6 block">
        <span className="text-xs uppercase tracking-[0.18em] text-fresh-text-tertiary">
          What happened
        </span>
        <textarea
          rows={4}
          autoFocus
          value={props.text}
          onChange={(e) => props.onTextChange(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-3 text-base text-fresh-text-primary backdrop-blur-xl placeholder:text-fresh-text-tertiary focus:border-fresh-accent-primary focus:outline-none focus:ring-2 focus:ring-fresh-accent-primary/30"
          placeholder="Write it in your own words."
        />
      </label>
      <input
        ref={props.photoRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => props.onPickAttachment(e.target.files?.[0] ?? null)}
      />
      <div className="mt-3">
        {!props.attachment && !props.attachmentBusy && (
          <button
            type="button"
            onClick={() => props.photoRef.current?.click()}
            className="w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass py-3 text-sm font-medium text-fresh-text-primary backdrop-blur-xl transition hover:bg-fresh-surface-raised"
          >
            📷 Add a photo (optional)
          </button>
        )}
        {props.attachmentBusy && (
          <p className="text-xs text-fresh-text-secondary">Reading photo…</p>
        )}
        {props.attachment && !props.attachmentBusy && (
          <div className="flex items-center justify-between rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-2 backdrop-blur-xl">
            <p className="truncate text-xs text-fresh-text-secondary">
              ✓ {props.attachment.name} —{' '}
              {Math.round(props.attachment.size / 1024)} KB
            </p>
            <button
              type="button"
              onClick={props.onClearAttachment}
              className="ml-2 shrink-0 text-xs text-fresh-text-tertiary hover:text-fresh-text-primary"
            >
              Remove
            </button>
          </div>
        )}
      </div>
      <button
        type="submit"
        className="mt-6 w-full rounded-2xl bg-fresh-accent-primary py-3.5 font-medium text-fresh-text-inverse shadow-[0_8px_30px_-8px_rgba(192,252,77,0.6)] transition active:animate-fresh-press motion-reduce:active:animate-none"
      >
        Continue
      </button>
      {props.error && (
        <p className="mt-3 text-sm text-fresh-accent-danger" role="alert">
          {props.error}
        </p>
      )}
      <p className="mt-4 text-center text-xs text-fresh-text-tertiary">
        You can leave both empty — your wallet will still get set up.
      </p>
    </form>
  );
}

function NameStep(props: {
  displayName: string;
  onDisplayNameChange: (v: string) => void;
  birthday: string;
  onBirthdayChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  error: string | null;
}) {
  return (
    <form onSubmit={props.onSubmit}>
      <h1 className="text-fresh-display font-fresh-display text-fresh-text-primary">
        Your name on the record.
      </h1>
      <p className="mt-3 text-sm text-fresh-text-secondary">
        Whatever you want to be called. You can change how you share it later;
        the wallet keeps the full record either way.
      </p>
      <label className="mt-8 block">
        <span className="text-xs uppercase tracking-[0.18em] text-fresh-text-tertiary">
          What people call you
        </span>
        <input
          type="text"
          required
          autoFocus
          autoComplete="name"
          maxLength={64}
          value={props.displayName}
          onChange={(e) => props.onDisplayNameChange(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-3 text-base text-fresh-text-primary backdrop-blur-xl placeholder:text-fresh-text-tertiary focus:border-fresh-accent-primary focus:outline-none focus:ring-2 focus:ring-fresh-accent-primary/30"
          placeholder="Ada"
        />
      </label>
      <label className="mt-4 block">
        <span className="text-xs uppercase tracking-[0.18em] text-fresh-text-tertiary">
          Birthday <span className="lowercase text-fresh-text-tertiary/70">(optional · enables one-tap age proofs)</span>
        </span>
        <input
          type="date"
          autoComplete="bday"
          value={props.birthday}
          onChange={(e) => props.onBirthdayChange(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          className="mt-2 w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-3 text-base text-fresh-text-primary backdrop-blur-xl focus:border-fresh-accent-primary focus:outline-none focus:ring-2 focus:ring-fresh-accent-primary/30"
        />
      </label>
      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          className="flex-1 rounded-2xl bg-fresh-accent-primary py-3.5 font-medium text-fresh-text-inverse shadow-[0_8px_30px_-8px_rgba(192,252,77,0.6)] transition active:animate-fresh-press motion-reduce:active:animate-none"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={props.onBack}
          className="rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 text-sm text-fresh-text-primary backdrop-blur-xl"
        >
          Back
        </button>
      </div>
      {props.error && (
        <p className="mt-3 text-sm text-fresh-accent-danger" role="alert">
          {props.error}
        </p>
      )}
    </form>
  );
}

function PassphraseStep(props: {
  passphrase: string;
  confirmPassphrase: string;
  onPassphraseChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  error: string | null;
}) {
  return (
    <form onSubmit={props.onSubmit}>
      <h1 className="text-fresh-display font-fresh-display text-fresh-text-primary">
        Pick a passphrase.
      </h1>
      <p className="mt-3 text-sm text-fresh-text-secondary">
        This is the only secret only you know. We never see it. Pick something
        memorable — a phrase, not a password.
      </p>
      <label className="mt-8 block">
        <span className="text-xs uppercase tracking-[0.18em] text-fresh-text-tertiary">
          Passphrase
        </span>
        <input
          type="password"
          required
          autoFocus
          autoComplete="new-password"
          value={props.passphrase}
          onChange={(e) => props.onPassphraseChange(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-3 text-base text-fresh-text-primary backdrop-blur-xl placeholder:text-fresh-text-tertiary focus:border-fresh-accent-primary focus:outline-none focus:ring-2 focus:ring-fresh-accent-primary/30"
        />
      </label>
      <label className="mt-3 block">
        <span className="text-xs uppercase tracking-[0.18em] text-fresh-text-tertiary">
          Confirm
        </span>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={props.confirmPassphrase}
          onChange={(e) => props.onConfirmChange(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-3 text-base text-fresh-text-primary backdrop-blur-xl placeholder:text-fresh-text-tertiary focus:border-fresh-accent-primary focus:outline-none focus:ring-2 focus:ring-fresh-accent-primary/30"
        />
      </label>
      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          className="flex-1 rounded-2xl bg-fresh-accent-primary py-3.5 font-medium text-fresh-text-inverse shadow-[0_8px_30px_-8px_rgba(192,252,77,0.6)] transition active:animate-fresh-press motion-reduce:active:animate-none"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={props.onBack}
          className="rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 text-sm text-fresh-text-primary backdrop-blur-xl"
        >
          Back
        </button>
      </div>
      {props.error && (
        <p className="mt-3 text-sm text-fresh-accent-danger" role="alert">
          {props.error}
        </p>
      )}
    </form>
  );
}

function RecoveryStep(props: { onAcknowledge: () => void; onBack: () => void }) {
  return (
    <div>
      <h1 className="text-fresh-display font-fresh-display text-fresh-text-primary">
        Three ways back in.
      </h1>
      <p className="mt-3 text-sm text-fresh-text-secondary">
        If you ever lose this device, here is how you get yourself back. You
        don't have to set anything up right now — just know they're here.
      </p>
      <div className="mt-6 space-y-3">
        <RecoveryCard
          icon="🔑"
          title="A paper key"
          body="A single string you write down once, fold up, and stash somewhere safe. Anyone with it can restore your wallet — so treat it like a house key."
        />
        <RecoveryCard
          icon="👯"
          title="A small circle of friends"
          body="Add a few people you trust. If you lose this device, enough of them together can help you get back in — none of them alone."
        />
        <RecoveryCard
          icon="💾"
          title="An encrypted file"
          body="A backup file you download anywhere — cloud drive, USB stick, email to yourself. Useless to anyone without your passphrase."
        />
      </div>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={props.onAcknowledge}
          className="flex-1 rounded-2xl bg-fresh-accent-primary py-3.5 font-medium text-fresh-text-inverse shadow-[0_8px_30px_-8px_rgba(192,252,77,0.6)] transition active:animate-fresh-press motion-reduce:active:animate-none"
        >
          Got it, continue
        </button>
        <button
          type="button"
          onClick={props.onBack}
          className="rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 text-sm text-fresh-text-primary backdrop-blur-xl"
        >
          Back
        </button>
      </div>
    </div>
  );
}

function RecoveryCard(props: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-3 backdrop-blur-xl">
      <p className="text-sm font-medium text-fresh-text-primary">
        <span className="mr-2" aria-hidden>
          {props.icon}
        </span>
        {props.title}
      </p>
      <p className="mt-1 text-xs text-fresh-text-secondary">{props.body}</p>
    </div>
  );
}

function EmailStep(props: {
  email: string;
  onEmailChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  busy: boolean;
  error: string | null;
}) {
  return (
    <form onSubmit={props.onSubmit}>
      <h1 className="text-fresh-display font-fresh-display text-fresh-text-primary">
        Last step.
      </h1>
      <p className="mt-3 text-sm text-fresh-text-secondary">
        Your email keeps the wallet linked to you across devices. We mail you
        a code — no password, nothing to remember besides your passphrase.
      </p>
      <label className="mt-8 block">
        <span className="text-xs uppercase tracking-[0.18em] text-fresh-text-tertiary">
          Email
        </span>
        <input
          type="email"
          required
          autoFocus
          autoComplete="email"
          inputMode="email"
          value={props.email}
          onChange={(e) => props.onEmailChange(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-3 text-base text-fresh-text-primary backdrop-blur-xl placeholder:text-fresh-text-tertiary focus:border-fresh-accent-primary focus:outline-none focus:ring-2 focus:ring-fresh-accent-primary/30"
          placeholder="you@example.com"
        />
      </label>
      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          disabled={props.busy || props.email.trim().length === 0}
          className="flex-1 rounded-2xl bg-fresh-accent-primary py-3.5 font-medium text-fresh-text-inverse shadow-[0_8px_30px_-8px_rgba(192,252,77,0.6)] transition active:animate-fresh-press disabled:opacity-40 disabled:shadow-none motion-reduce:active:animate-none"
        >
          {props.busy ? 'Sending…' : 'Send my code'}
        </button>
        <button
          type="button"
          onClick={props.onBack}
          className="rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 text-sm text-fresh-text-primary backdrop-blur-xl"
        >
          Back
        </button>
      </div>
      {props.error && (
        <p className="mt-3 text-sm text-fresh-accent-danger" role="alert">
          {props.error}
        </p>
      )}
    </form>
  );
}

function CodeStep(props: {
  email: string;
  code: string;
  onCodeChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onResend: () => void;
  onChangeEmail: () => void;
  busy: boolean;
  resent: boolean;
  error: string | null;
}) {
  return (
    <form onSubmit={props.onSubmit}>
      <h1 className="text-fresh-display font-fresh-display text-fresh-text-primary">
        Check your email.
      </h1>
      <p className="mt-3 text-sm text-fresh-text-secondary">
        A six-digit code is on its way to{' '}
        <span className="font-medium text-fresh-text-primary">
          {props.email}
        </span>
        . Drop it below — when you do, your first entry gets signed and your
        wallet is real.
      </p>
      <label className="mt-8 block">
        <span className="text-xs uppercase tracking-[0.18em] text-fresh-text-tertiary">
          6-digit code
        </span>
        <input
          type="text"
          required
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={8}
          value={props.code}
          onChange={(e) => props.onCodeChange(e.target.value.replace(/\s/g, ''))}
          className="mt-2 w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-3 text-center font-fresh-mono text-xl tracking-[0.4em] text-fresh-text-primary backdrop-blur-xl placeholder:text-fresh-text-tertiary focus:border-fresh-accent-primary focus:outline-none focus:ring-2 focus:ring-fresh-accent-primary/30"
          placeholder="123456"
        />
      </label>
      <button
        type="submit"
        disabled={props.busy || props.code.trim().length === 0}
        className="mt-6 w-full rounded-2xl bg-fresh-accent-primary py-3.5 font-medium text-fresh-text-inverse shadow-[0_8px_30px_-8px_rgba(192,252,77,0.6)] transition active:animate-fresh-press disabled:opacity-40 disabled:shadow-none motion-reduce:active:animate-none"
      >
        {props.busy ? 'Signing you in…' : 'Verify & sign my first entry'}
      </button>
      {props.error && (
        <p className="mt-3 text-sm text-fresh-accent-danger" role="alert">
          {props.error}
        </p>
      )}
      <div className="mt-8 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={props.onChangeEmail}
          className="text-fresh-text-tertiary transition hover:text-fresh-text-primary"
        >
          ← Use a different email
        </button>
        <button
          type="button"
          onClick={props.onResend}
          disabled={props.busy}
          className="font-medium text-fresh-accent-primary transition hover:underline disabled:opacity-40"
        >
          {props.resent ? 'Code resent' : 'Resend code'}
        </button>
      </div>
    </form>
  );
}
