import { useState } from 'react';
import { supabase } from '../../shared/lib/supabase.ts';

// Two-step in-app login: email → 6-digit code.
//
// Why a code and not a magic link: on iOS, a magic link in an email
// opens in Safari — NOT in the installed PWA. The auth session then
// lands in Safari's storage scope and the PWA, a separate scope,
// never sees it, so the user is asked to log in every time they
// open the wallet. A typed code keeps the entire login inside
// whatever context the user is already in: they read the code from
// their email, type it into the wallet, verifyOtp runs in-app, and
// the session persists in the same storage the wallet reads on the
// next launch.
//
// Operator-side requirement: the Supabase "Magic Link" email
// template must include the {{ .Token }} variable so the email
// carries the 6-digit code. It can keep {{ .ConfirmationURL }} too
// — the /auth/callback route still handles a clicked link as a
// fallback — but the code is the primary path.

type Step = 'email' | 'code';
type Status = 'idle' | 'busy' | 'error';

export function LoginPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  async function sendCode(targetEmail: string) {
    setStatus('busy');
    setError(null);
    const { error: err } = await supabase().auth.signInWithOtp({
      email: targetEmail,
      options: {
        shouldCreateUser: true,
        // Kept as a fallback for anyone who clicks the link instead
        // of typing the code; /auth/callback handles it.
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
    // Success: onAuthStateChange fires, useSession picks up the
    // session, AuthGate clears. No redirect — the session is now in
    // this context's storage and will persist across launches.
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
      <div className="min-h-screen flex items-center justify-center p-6">
        <form onSubmit={submitCode} className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold">Enter your code</h1>
          <p className="mt-1 text-sm text-muted">
            We emailed a 6-digit code to{' '}
            <span className="font-mono">{email}</span>. Type it here to
            finish signing in — no need to leave this screen.
          </p>
          <label className="mt-6 block">
            <span className="text-sm font-medium">6-digit code</span>
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
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base tracking-widest font-mono focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="123456"
            />
          </label>
          <button
            type="submit"
            disabled={status === 'busy' || code.trim().length === 0}
            className="mt-4 w-full rounded-md bg-ink py-3 text-paper font-medium disabled:opacity-40"
          >
            {status === 'busy' ? 'Verifying…' : 'Verify & sign in'}
          </button>
          {error && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="mt-6 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setStep('email');
                setCode('');
                setError(null);
              }}
              className="text-muted hover:text-ink"
            >
              ← Use a different email
            </button>
            <button
              type="button"
              onClick={resend}
              disabled={status === 'busy'}
              className="text-accent hover:underline disabled:opacity-40"
            >
              {resent ? 'Code resent' : 'Resend code'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-xs uppercase tracking-wide text-accent">
          Tapit Wallet
        </div>
        <h1 className="mt-2 text-2xl font-semibold leading-snug">
          The record of your life belongs to you.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-ink/80">
          Somewhere along the way we handed the story of our lives to
          companies — our names, our histories, the proof of who we are —
          and let them hold it, lose it, or lock us out of it. Tapit Wallet
          takes it back. Your life is signed by your own key, kept on your
          own device, and held true by the people who actually know you. No
          company keeps it for you. No company can take it away. And because
          the people who love you can stand with you and vouch for it, your
          identity stays unmistakably, unfakeably yours.
        </p>
        <form onSubmit={submitEmail} className="mt-6">
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="you@example.com"
            />
          </label>
          <button
            type="submit"
            disabled={status === 'busy' || email.trim().length === 0}
            className="mt-4 w-full rounded-md bg-ink py-3 text-paper font-medium disabled:opacity-40"
          >
            {status === 'busy' ? 'Sending…' : 'Send my code'}
          </button>
          {error && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </form>
        <p className="mt-6 text-xs text-muted">
          We email you a 6-digit code to sign in. Your keypair is generated
          and held only on this device — never on the host.
        </p>
      </div>
    </div>
  );
}
