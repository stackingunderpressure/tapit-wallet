import { useState } from 'react';

interface Props {
  onSubmit: (displayName: string) => Promise<void>;
}

// Display-name capture for the first identity attestation. One
// field, two-tap flow. The display name is a leaf on the
// identity attestation's Merkle tree; the user can selectively
// disclose it later via the disclosureProof slot (Phase 4).
export function DisplayNamePrompt({ onSubmit }: Props) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError('Pick something to be called.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <h1 className="text-xl font-semibold">What should we call you?</h1>
        <p className="mt-1 text-sm text-muted">
          This goes on your first identity attestation — the one the wallet
          signs about itself. You can share it later or keep it private; the
          wallet holds the full attestation either way.
        </p>
        <label className="mt-6 block">
          <span className="text-sm font-medium">Display name</span>
          <input
            type="text"
            required
            autoComplete="name"
            autoFocus
            maxLength={64}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            placeholder="Ada"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-md bg-ink py-3 text-paper font-medium disabled:opacity-40"
        >
          {busy ? 'Signing your identity…' : 'Continue'}
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
