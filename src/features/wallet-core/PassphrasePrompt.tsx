import { useState } from 'react';

interface Props {
  onSubmit: (passphrase: string) => Promise<void>;
}

// First-login passphrase capture. Two fields with confirmation, no
// strength meter (DESIGN.md §5 — "can be as simple as a memorable
// phrase"). The passphrase is the only secret the user needs to
// remember; everything else flows from it.
export function PassphrasePrompt({ onSubmit }: Props) {
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pass !== confirm) {
      setError('Passphrases do not match.');
      return;
    }
    if (pass.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(pass);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <h1 className="text-xl font-semibold">Choose a passphrase</h1>
        <p className="mt-1 text-sm text-muted">
          Your wallet is encrypted under this passphrase. The host never sees it.
          Pick something memorable — a phrase, not a password.
        </p>
        <label className="mt-6 block">
          <span className="text-sm font-medium">Passphrase</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>
        <label className="mt-3 block">
          <span className="text-sm font-medium">Confirm passphrase</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-md bg-ink py-3 text-paper font-medium disabled:opacity-40"
        >
          {busy ? 'Generating wallet…' : 'Create my wallet'}
        </button>
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
