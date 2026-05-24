import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../shared/lib/supabase.ts';
import { useSession } from '../auth/useSession.ts';
import { FreshOnboarding } from '../onboarding/FreshOnboarding.tsx';

// The Fresh-themed landing surface. Renders when the device-level
// theme resolves to 'fresh' — replaces the Classic WalletGuide at
// /login. Self-contained: owns its own loading + signed-in shells
// using the same supabase().auth APIs as WalletGuide so behaviour
// stays identical, only the visual register differs.
//
// What it deliberately does NOT carry: the four reference tabs
// (Why/What/Recovery/Sovereignty). The Fresh audience does not
// want a marketing essay at the door; the brief is explicit. The
// reference surface stays one tap away at /about for anyone who
// wants it.
//
// Composition: loading → "Checking your session…" inside the
// aurora-drift shell; signed-in → FreshSignedInLanding ("You're
// in." plus a Back to wallet button); signed-out → the new
// FreshOnboarding 90-second compose-before-login state machine
// (Cut 5). Shipped originally as Cut 2; Cut 5 swapped the
// signed-out leaf from a single email-form to the full
// FreshOnboarding flow.

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

  return <FreshOnboarding />;
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
