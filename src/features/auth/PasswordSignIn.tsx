import { useState } from 'react';
import { supabase } from '../../shared/lib/supabase.ts';

// Email + password sign-in (2026-06-14). A third login option alongside the
// magic-link code and Google/Apple OAuth — added to make testing fast: no email
// round-trip at all, just type and click. Like every login here it's only the
// account/sync handle; the wallet key stays client-side, untouched.
//
// Sign in uses signInWithPassword. "Create account" uses signUp — which returns
// a session immediately ONLY if "Confirm email" is OFF in the Supabase project
// (the operator's dev setting); with confirmation ON it emails a link (back to
// the rate-limited mailer), so for frictionless testing turn confirmation off.
//
// On success, onAuthStateChange flips the session and AuthGate/WalletProvider
// take over (returning user -> unlock; brand-new -> first-login passphrase).

interface Props {
  fresh?: boolean;
}

export function PasswordSignIn({ fresh = false }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<null | 'in' | 'up'>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const disabled = email.trim().length === 0 || password.length === 0;

  async function signIn() {
    setBusy('in');
    setError(null);
    setNote(null);
    const { error: err } = await supabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (err) {
      setError(err.message);
      setBusy(null);
    }
    // success -> onAuthStateChange handles the rest
  }

  async function createAccount() {
    setBusy('up');
    setError(null);
    setNote(null);
    const { data, error: err } = await supabase().auth.signUp({
      email: email.trim(),
      password,
    });
    if (err) {
      setError(err.message);
      setBusy(null);
      return;
    }
    if (!data.session) {
      // Confirmation is on — Supabase sent a confirm email instead of a session.
      setNote('Account created — confirm via the email we sent, then sign in.');
      setBusy(null);
    }
    // session present -> onAuthStateChange handles it
  }

  const input = fresh
    ? 'border-fresh-surface-edge bg-fresh-surface-glass text-fresh-text-primary backdrop-blur-xl placeholder:text-fresh-text-tertiary focus:border-fresh-accent-primary focus:ring-fresh-accent-primary/30'
    : 'border-ink/15 bg-paper/70 text-ink focus:border-accent focus:bg-white focus:ring-accent/15';
  const primary = fresh
    ? 'bg-fresh-accent-primary text-fresh-text-inverse'
    : 'bg-gradient-to-b from-accent to-[#22503b] text-paper shadow-lg shadow-accent/30';
  const secondary = fresh
    ? 'border-fresh-surface-edge bg-fresh-surface-glass text-fresh-text-primary backdrop-blur-xl'
    : 'border-ink/15 bg-white text-ink hover:bg-ink/[0.03]';

  return (
    <div className="space-y-3">
      <input
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={`w-full rounded-xl border px-3.5 py-2.5 text-base focus:outline-none focus:ring-4 ${input}`}
        placeholder="you@example.com"
      />
      <input
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={`w-full rounded-xl border px-3.5 py-2.5 text-base focus:outline-none focus:ring-4 ${input}`}
        placeholder="Password"
      />
      <button
        type="button"
        onClick={() => void signIn()}
        disabled={busy !== null || disabled}
        className={`w-full rounded-xl py-3 text-sm font-medium transition active:scale-[0.99] disabled:opacity-40 ${primary}`}
      >
        {busy === 'in' ? 'Signing in…' : 'Sign in with password'}
      </button>
      <button
        type="button"
        onClick={() => void createAccount()}
        disabled={busy !== null || disabled}
        className={`w-full rounded-xl border py-2.5 text-sm font-medium transition active:scale-[0.99] disabled:opacity-40 ${secondary}`}
      >
        {busy === 'up' ? 'Creating…' : 'Create account with password'}
      </button>
      {error && (
        <p className={`text-sm ${fresh ? 'text-fresh-accent-danger' : 'text-red-600'}`} role="alert">
          {error}
        </p>
      )}
      {note && (
        <p className={`text-sm ${fresh ? 'text-fresh-text-secondary' : 'text-muted'}`} role="status">
          {note}
        </p>
      )}
    </div>
  );
}
