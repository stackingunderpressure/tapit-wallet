import { useState } from 'react';

interface Props {
  onSubmit: (passphrase: string) => Promise<void>;
}

// Returning-user passphrase prompt. Single field. The unlock failure
// message comes from unlockWallet so the user gets a stable retry
// flow without leaking internal cipher errors.
export function UnlockPrompt({ onSubmit }: Props) {
  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(pass);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
      setPass('');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <h1 className="text-xl font-semibold">Unlock your wallet</h1>
        <p className="mt-1 text-sm text-muted">
          Enter the passphrase you set when you created this wallet.
        </p>
        <label className="mt-6 block">
          <span className="text-sm font-medium">Passphrase</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            autoFocus
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>
        <button
          type="submit"
          disabled={busy || pass.length === 0}
          className="mt-4 w-full rounded-md bg-ink py-3 text-paper font-medium disabled:opacity-40"
        >
          {busy ? 'Unlocking…' : 'Unlock'}
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
