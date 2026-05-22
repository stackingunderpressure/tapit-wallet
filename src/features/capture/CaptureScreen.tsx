import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWallet } from '../wallet-core/useWallet.ts';
import { useAnchorWorker } from '../anchoring/useAnchorWorker.ts';
import { createJournalEntry } from '../journal/createJournalEntry.ts';

// The capture bridge — Phase 4.5 Tier 1 (Web Share Target, GET).
// When the OS shares text or a link into the installed wallet it
// opens this route at /capture?title=&text=&url=. The shared
// content is composed into an editable body the person confirms;
// confirming signs and OpenTimestamps-anchors a journal-kind
// attestation marked source=capture, so the home Captured tab can
// surface it apart from the diary.
//
// Tier 1 is text and links only: the hand-rolled service worker
// handles GET requests, so a GET share target needs no service-
// worker change. Sharing files in needs a POST the service worker
// must intercept — that is the Tier 1b follow-on.

// Shares routinely repeat the same string across title/text/url;
// dedupe so the body is not "url url url".
function composeShared(title: string, text: string, url: string): string {
  const parts: string[] = [];
  for (const raw of [title, text, url]) {
    const t = raw.trim();
    if (t.length > 0 && !parts.includes(t)) parts.push(t);
  }
  return parts.join('\n\n');
}

export function CaptureScreen() {
  const { wallet, ownerId, passphrase, prefs, save } = useWallet();
  const worker = useAnchorWorker();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const initial = useMemo(
    () =>
      composeShared(
        params.get('title') ?? '',
        params.get('text') ?? '',
        params.get('url') ?? '',
      ),
    [params],
  );
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length === 0) {
      setError('Nothing to capture — paste or type something first.');
      return;
    }
    if (!passphrase) {
      setError('Wallet is locked — sign in again.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createJournalEntry(
        wallet,
        ownerId,
        passphrase,
        worker,
        {
          text: text.trim(),
          category: 'Captured',
          subject: wallet.identity,
          source: 'capture',
        },
        prefs.cloudSync,
      );
      // Persist so the held attestation survives a reload.
      await save();
      navigate(`/entry/${result.digestHex}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save capture.');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen p-5 max-w-md mx-auto">
      <header className="py-2">
        <div className="text-xs uppercase tracking-wide text-accent">
          Capture
        </div>
        <h1 className="mt-1 text-xl font-semibold">Timestamp this</h1>
        <p className="mt-1 text-sm text-muted">
          Sign and time-anchor what you brought into your wallet. It
          becomes a permanent, tamper-evident record that you hold.
        </p>
      </header>

      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label className="text-sm font-medium" htmlFor="capture-text">
            What you're capturing
          </label>
          <textarea
            id="capture-text"
            required
            rows={8}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            placeholder="Paste or type what you want to timestamp."
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-md bg-ink py-3 text-paper font-medium disabled:opacity-40"
          >
            {busy ? 'Signing your capture…' : 'Sign & timestamp'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            disabled={busy}
            className="rounded-md border border-ink/15 px-4 py-2 text-sm"
          >
            Cancel
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
