import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../shared/lib/supabase.ts';
import { useSession } from '../auth/useSession.ts';

// The Fresh-themed landing surface. Renders when the device-level
// theme resolves to 'fresh' — replaces the Classic WalletGuide at
// /login. Self-contained: owns its own sign-in form using the same
// supabase().auth APIs as WalletGuide so behaviour stays identical,
// only the visual register differs.
//
// What it deliberately does NOT carry: the four reference tabs
// (Why/What/Recovery/Sovereignty). The Fresh audience does not
// want a marketing essay at the door; the brief is explicit. They
// type a sentence about their day OR sign in. The reference surface
// stays one tap away at /about for anyone who wants it.
//
// Shipped as part of Cut 2 of the Fresh young-adult-friendly theme
// + IA roadmap (2026-05-24).

type AuthStep = 'email' | 'code';
type AuthStatus = 'idle' | 'busy' | 'error';

export function FreshLoginShell() {
  const session = useSession();

  if (session.status === 'loading') {
    return (
      <div className="relative min-h-screen overflow-hidden fresh-aurora-bg flex items-center justify-center">
        <p className="text-fresh-text-secondary text-sm">Checking your session…</p>
      </div>
    );
  }

  if (session.status === 'signed-in') {
    return <FreshSignedInLanding email={session.session?.user.email ?? null} />;
  }

  return <FreshSignInLanding />;
}

function FreshWordmark() {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="h-2 w-2 rounded-full bg-fresh-accent-primary shadow-[0_0_18px_rgba(192,252,77,0.7)]"
      />
      <span className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-fresh-text-primary">
        Tapit Wallet
      </span>
    </div>
  );
}

function FreshAboutLink() {
  return (
    <Link
      to="/about"
      className="text-xs text-fresh-text-tertiary hover:text-fresh-text-primary transition"
    >
      What is this? →
    </Link>
  );
}

function FreshShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden fresh-aurora-bg">
      <div className="relative mx-auto max-w-md px-5 py-8">
        <header className="mb-10 flex items-center justify-between">
          <FreshWordmark />
          <FreshAboutLink />
        </header>
        <main className="animate-fresh-rise motion-reduce:animate-none">
          {children}
        </main>
      </div>
    </div>
  );
}

function FreshSignInLanding() {
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<AuthStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  async function sendCode(targetEmail: string) {
    setStatus('busy');
    setError(null);
    const { error: err } = await supabase().auth.signInWithOtp({
      email: targetEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (err) {
      setStatus('error');
      setError(err.message);
      return false;
    }
    setStatus('idle');
    return true;
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    const ok = await sendCode(email.trim());
    if (ok) setStep('code');
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus('busy');
    setError(null);
    const { error: err } = await supabase().auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    if (err) {
      setStatus('error');
      setError(err.message);
      return;
    }
  }

  async function resend() {
    const ok = await sendCode(email.trim());
    if (ok) {
      setResent(true);
      setTimeout(() => setResent(false), 2500);
    }
  }

  if (step === 'code') {
    return (
      <FreshShell>
        <h1 className="text-fresh-display font-fresh-display text-fresh-text-primary">
          Check your email.
        </h1>
        <p className="mt-3 text-sm text-fresh-text-secondary">
          A six-digit code is on its way to{' '}
          <span className="font-medium text-fresh-text-primary">{email}</span>.
          Drop it below to finish.
        </p>
        <form onSubmit={submitCode} className="mt-8">
          <label className="block">
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
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
              className="mt-2 w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-3 text-center font-fresh-mono text-xl tracking-[0.4em] text-fresh-text-primary backdrop-blur-xl placeholder:text-fresh-text-tertiary focus:border-fresh-accent-primary focus:outline-none focus:ring-2 focus:ring-fresh-accent-primary/30"
              placeholder="123456"
            />
          </label>
          <button
            type="submit"
            disabled={status === 'busy' || code.trim().length === 0}
            className="mt-6 w-full rounded-2xl bg-fresh-accent-primary py-3.5 font-medium text-fresh-text-inverse shadow-[0_8px_30px_-8px_rgba(192,252,77,0.6)] transition active:animate-fresh-press disabled:opacity-40 disabled:shadow-none motion-reduce:transition-none motion-reduce:active:animate-none"
          >
            {status === 'busy' ? 'Verifying…' : 'Verify & sign in'}
          </button>
          {error && (
            <p className="mt-3 text-sm text-fresh-accent-danger" role="alert">
              {error}
            </p>
          )}
        </form>
        <div className="mt-8 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
            className="text-fresh-text-tertiary transition hover:text-fresh-text-primary"
          >
            ← Use a different email
          </button>
          <button
            type="button"
            onClick={resend}
            disabled={status === 'busy'}
            className="font-medium text-fresh-accent-primary transition hover:underline disabled:opacity-40"
          >
            {resent ? 'Code resent' : 'Resend code'}
          </button>
        </div>
      </FreshShell>
    );
  }

  return (
    <FreshShell>
      <h1 className="text-fresh-display font-fresh-display text-fresh-text-primary">
        Hold your own life,
        <br />
        on your own terms.
      </h1>
      <p className="mt-3 text-sm text-fresh-text-secondary">
        Your keys live only on this device. We email you a code, you sign
        in, and from there everything you sign is yours — not a row in
        someone else's database.
      </p>
      <form onSubmit={submitEmail} className="mt-8">
        <label className="block">
          <span className="text-xs uppercase tracking-[0.18em] text-fresh-text-tertiary">
            Email
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-3 text-base text-fresh-text-primary backdrop-blur-xl placeholder:text-fresh-text-tertiary focus:border-fresh-accent-primary focus:outline-none focus:ring-2 focus:ring-fresh-accent-primary/30"
            placeholder="you@example.com"
          />
        </label>
        <button
          type="submit"
          disabled={status === 'busy' || email.trim().length === 0}
          className="mt-6 w-full rounded-2xl bg-fresh-accent-primary py-3.5 font-medium text-fresh-text-inverse shadow-[0_8px_30px_-8px_rgba(192,252,77,0.6)] transition active:animate-fresh-press disabled:opacity-40 disabled:shadow-none motion-reduce:transition-none motion-reduce:active:animate-none"
        >
          {status === 'busy' ? 'Sending…' : 'Send my code'}
        </button>
        {error && (
          <p className="mt-3 text-sm text-fresh-accent-danger" role="alert">
            {error}
          </p>
        )}
      </form>
    </FreshShell>
  );
}

function FreshSignedInLanding({ email }: { email: string | null }) {
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function doSignOut() {
    setSigningOut(true);
    setSignOutError(null);
    const { error } = await supabase().auth.signOut();
    if (error) {
      setSignOutError(error.message);
      setSigningOut(false);
    }
  }

  return (
    <FreshShell>
      <h1 className="text-fresh-display font-fresh-display text-fresh-text-primary">
        You're in.
      </h1>
      <p className="mt-3 text-sm text-fresh-text-secondary">
        {email
          ? `Signed in as ${email}. Your keypair and attestations live on this device, encrypted under your passphrase.`
          : 'Your keypair and attestations live on this device, encrypted under your passphrase.'}
      </p>
      <div className="mt-8 grid grid-cols-2 gap-3">
        <Link
          to="/"
          className="rounded-2xl bg-fresh-accent-primary py-3.5 text-center font-medium text-fresh-text-inverse shadow-[0_8px_30px_-8px_rgba(192,252,77,0.6)] transition active:animate-fresh-press motion-reduce:active:animate-none"
        >
          Back to wallet
        </Link>
        <button
          type="button"
          onClick={() => void doSignOut()}
          disabled={signingOut}
          className="rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass py-3.5 text-sm font-medium text-fresh-text-primary backdrop-blur-xl transition hover:bg-fresh-surface-raised disabled:opacity-40"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
      {signOutError && (
        <p className="mt-4 text-sm text-fresh-accent-danger" role="alert">
          {signOutError}
        </p>
      )}
    </FreshShell>
  );
}
