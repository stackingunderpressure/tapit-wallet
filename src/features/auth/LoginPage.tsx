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

// The login screen doubles as the wallet's landing page — there is no
// separate marketing site. Frame is the shared shell: a warm paper
// field, two soft drifting colour glows, and a frosted card that
// rises in on mount. Both the email and code steps render inside it.
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-paper">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-28 -top-32 h-[26rem] w-[26rem] animate-float rounded-full bg-accent/25 blur-3xl motion-reduce:animate-none"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-36 -right-28 h-[30rem] w-[30rem] animate-float-slow rounded-full bg-amber-400/20 blur-3xl motion-reduce:animate-none"
      />
      <div className="relative flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm animate-rise rounded-2xl border border-ink/10 bg-white/85 p-8 shadow-[0_24px_70px_-20px_rgba(15,20,25,0.35)] backdrop-blur-md motion-reduce:animate-none">
          {children}
        </div>
      </div>
    </div>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent">
        Tapit Wallet
      </span>
    </div>
  );
}

const inputClass =
  'mt-1.5 w-full rounded-xl border border-ink/15 bg-paper/70 px-3.5 py-2.5 text-base text-ink transition focus:border-accent focus:bg-white focus:outline-none focus:ring-4 focus:ring-accent/15';

const buttonClass =
  'mt-5 w-full rounded-xl bg-gradient-to-b from-accent to-[#22503b] py-3.5 font-medium text-paper shadow-lg shadow-accent/30 transition active:scale-[0.99] disabled:opacity-40 disabled:shadow-none';

const dividerClass =
  'my-6 h-px bg-gradient-to-r from-transparent via-ink/10 to-transparent';

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
      <Frame>
        <Wordmark />
        <h1 className="mt-5 font-serif text-[1.8rem] font-semibold leading-[1.15] text-ink">
          Enter your code
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink/70">
          We emailed a 6-digit code to{' '}
          <span className="font-medium text-ink">{email}</span>. Type it
          here to finish signing in — no need to leave this screen.
        </p>
        <form onSubmit={submitCode} className="mt-6">
          <label className="block">
            <span className="text-sm font-medium text-ink">6-digit code</span>
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
              className={`${inputClass} text-center font-mono text-lg tracking-[0.3em]`}
              placeholder="123456"
            />
          </label>
          <button
            type="submit"
            disabled={status === 'busy' || code.trim().length === 0}
            className={buttonClass}
          >
            {status === 'busy' ? 'Verifying…' : 'Verify & sign in'}
          </button>
          {error && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </form>
        <div className={dividerClass} />
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
            className="text-muted transition hover:text-ink"
          >
            ← Use a different email
          </button>
          <button
            type="button"
            onClick={resend}
            disabled={status === 'busy'}
            className="font-medium text-accent transition hover:underline disabled:opacity-40"
          >
            {resent ? 'Code resent' : 'Resend code'}
          </button>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <Wordmark />
      <h1 className="mt-5 font-serif text-[1.8rem] font-semibold leading-[1.15] text-ink">
        The record of your life belongs to you.
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-ink/70">
        Somewhere along the way we handed the story of our lives to
        companies — our names, our histories, the proof of who we are —
        and let them hold it, lose it, or lock us out of it. Tapit Wallet
        takes it back. Your life is signed by your own key, kept on your
        own device, and held true by the people who actually know you. No
        company keeps it for you. No company can take it away. And because
        the people who love you can stand with you and vouch for it, your
        identity stays unmistakably, unfakeably yours.
      </p>
      <div className={dividerClass} />
      <form onSubmit={submitEmail}>
        <label className="block">
          <span className="text-sm font-medium text-ink">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@example.com"
          />
        </label>
        <button
          type="submit"
          disabled={status === 'busy' || email.trim().length === 0}
          className={buttonClass}
        >
          {status === 'busy' ? 'Sending…' : 'Send my code'}
        </button>
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </form>
      <p className="mt-6 text-xs leading-relaxed text-muted">
        We email you a 6-digit code to sign in. Your keypair is generated
        and held only on this device — never on the host.
      </p>
    </Frame>
  );
}
