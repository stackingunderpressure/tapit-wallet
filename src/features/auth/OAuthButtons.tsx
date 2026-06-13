import { useState } from 'react';
import { supabase } from '../../shared/lib/supabase.ts';

// One-tap social sign-in (2026-06-13). The email magic-link path hits
// Supabase's built-in mailer rate limit during repeated use; OAuth has no
// such limit, sends no email, and is one tap. It maps the same way to the
// account handle (ownerId) that keys the encrypted blob, so cross-device
// continuity is unchanged and NONE of this touches the wallet key — that is
// still generated and held client-side.
//
// signInWithOAuth navigates the browser to the provider and back to
// /auth/callback, where AuthCallback (Supabase detectSessionInUrl) settles the
// session exactly like the magic-link return. Provider credentials are set in
// the Supabase dashboard (operator's step); this is only the client trigger.
//
// `fresh` switches the styling for the dark Fresh surface; default is Classic.

interface Props {
  fresh?: boolean;
}

export function OAuthButtons({ fresh = false }: Props) {
  const [busy, setBusy] = useState<null | 'google' | 'apple'>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(provider: 'google' | 'apple') {
    setBusy(provider);
    setError(null);
    try {
      const { error: err } = await supabase().auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (err) {
        setError(err.message);
        setBusy(null);
      }
      // On success the browser navigates to the provider — nothing more to do.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start sign-in.');
      setBusy(null);
    }
  }

  const btn = fresh
    ? 'border-fresh-surface-edge bg-fresh-surface-glass text-fresh-text-primary backdrop-blur-xl hover:bg-fresh-surface-raised'
    : 'border-ink/15 bg-white text-ink hover:bg-ink/[0.03]';

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void go('google')}
        disabled={busy !== null}
        className={`w-full rounded-2xl border ${btn} py-3 text-sm font-medium transition active:scale-[0.99] disabled:opacity-50`}
      >
        {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
      </button>
      <button
        type="button"
        onClick={() => void go('apple')}
        disabled={busy !== null}
        className={`w-full rounded-2xl border ${btn} py-3 text-sm font-medium transition active:scale-[0.99] disabled:opacity-50`}
      >
        {busy === 'apple' ? 'Opening Apple…' : 'Continue with Apple'}
      </button>
      {error && (
        <p className={`text-sm ${fresh ? 'text-fresh-accent-danger' : 'text-red-600'}`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
