import { useState } from 'react';
import { supabase } from '../../shared/lib/supabase.ts';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError(null);
    const { error: err } = await supabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) {
      setStatus('error');
      setError(err.message);
      return;
    }
    setStatus('sent');
  }

  if (status === 'sent') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold">Check your email</h1>
          <p className="mt-2 text-muted">
            We sent a sign-in link to <span className="font-mono">{email}</span>.
            Open it on this device to finish signing in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold">Tapit Wallet</h1>
        <p className="mt-1 text-sm text-muted">
          Your sovereign identity wallet. Sign in with email.
        </p>
        <label className="mt-6 block">
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
          disabled={status === 'sending' || email.trim().length === 0}
          className="mt-4 w-full rounded-md bg-ink py-3 text-paper font-medium disabled:opacity-40"
        >
          {status === 'sending' ? 'Sending…' : 'Send sign-in link'}
        </button>
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <p className="mt-6 text-xs text-muted">
          The magic link signs you into the wallet host. Your keypair is generated
          and held only on this device — never on the host.
        </p>
      </form>
    </div>
  );
}
