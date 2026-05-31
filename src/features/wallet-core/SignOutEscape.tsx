import { useState } from 'react';
import { supabase } from '../../shared/lib/supabase.ts';

interface Props {
  /** Optional override for the link copy. Defaults to the unlock-screen
   *  wording; the pre-wallet screens (first-login, identity ceremony)
   *  pass their own since "Not your wallet?" reads oddly before a wallet
   *  even exists for this account. */
  label?: string;
}

// Self-contained sign-out escape for the pre-unlock full-screen phases
// (first-login passphrase capture, returning-user unlock, identity
// ceremony). Each of those screens is otherwise a dead-end: an operator
// who landed on the wrong email account — or who simply wants to sign in
// as someone else — has no way off the screen without completing it.
// Operator field-test 2026-05-31: "No place to send a new link or log
// out. If you can't get in you're stuck."
//
// Calling supabase().auth.signOut() clears the session; onAuthStateChange
// fires and AuthGate redirects to /login, where the email-entry form
// (signInWithOtp, any address) is the different-email sign-in surface.
// The local encrypted wallet snapshot is untouched — it stays in
// IndexedDB + cloud backup, so signing back in with the original email
// restores it. Self-contained (no prop threading) so any full-screen
// phase can drop it in without the host wiring a callback.
export function SignOutEscape({ label }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase().auth.signOut();
    if (err) {
      setError(err.message);
      setBusy(false);
    }
    // On success AuthGate redirects to /login; this component unmounts.
  }

  return (
    <div className="mt-6 text-center">
      <button
        type="button"
        onClick={() => void signOut()}
        disabled={busy}
        className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-40"
      >
        {busy
          ? 'Signing out…'
          : (label ?? 'Not your wallet? Sign out and use a different email')}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
