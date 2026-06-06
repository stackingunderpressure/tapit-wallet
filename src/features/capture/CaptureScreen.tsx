import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useWallet } from '../wallet-core/useWallet.ts';
import { useAnchorWorker } from '../anchoring/useAnchorWorker.ts';
import { createJournalEntry } from '../journal/createJournalEntry.ts';

// The capture bridge — the inbound "stamp anything" on-ramp. Two ways in:
//  (1) the OS shares text or a link into the installed wallet (Web Share
//      Target, GET) and we open /capture?title=&text=&url= with the body
//      pre-filled; and (2) the in-app camera, mounted here too (2026-06-05
//      "make capture bigger with the camera makeover") so a photo can be
//      born straight into a capture, not only arrive as shared text.
// On confirm we sign and OpenTimestamps-anchor a journal-kind attestation
// marked source=capture (with the photo, if any, stored encrypted and its
// SHA-256 committed as a leaf), so the home Captured tab surfaces it apart
// from the diary.
//
// ONE camera, many mounts: this reuses camera/CameraCaptureModal — the same
// device the diary composer uses — rather than duplicating it. Photos shared
// IN from other apps (a POST share target the service worker must intercept)
// is the Tier 1b follow-on; this screen handles in-app capture + the GET
// text/link share path.

const CameraCaptureModal = lazy(() =>
  import('../camera/CameraCaptureModal.tsx').then((m) => ({
    default: m.CameraCaptureModal,
  })),
);

// Shares routinely repeat the same string across title/text/url; dedupe so
// the body is not "url url url".
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
  const [photo, setPhoto] = useState<File | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = useMemo(
    () => (photo ? URL.createObjectURL(photo) : null),
    [photo],
  );
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length === 0 && !photo) {
      setError('Add a photo or some text to timestamp first.');
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
          ...(photo ? { attachment: photo } : {}),
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
        <Link to="/" className="text-sm text-muted hover:text-ink">
          ← Home
        </Link>
        <div className="mt-2 text-xs uppercase tracking-wide text-accent">
          Capture
        </div>
        <h1 className="mt-1 text-xl font-semibold">Stamp this</h1>
        <p className="mt-1 text-sm text-muted">
          Sign and time-anchor what you bring in — a photo, a quote, a link.
          It becomes a permanent, tamper-evident record that you hold.
        </p>
      </header>

      <form onSubmit={submit} className="mt-4 space-y-4">
        {/* Photo */}
        <div className="rounded-xl border border-ink/10 bg-paper/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Photo <span className="font-normal text-muted">(optional)</span>
            </span>
            {photo && (
              <button
                type="button"
                onClick={() => setPhoto(null)}
                disabled={busy}
                className="text-xs text-muted hover:text-ink"
              >
                Remove
              </button>
            )}
          </div>
          {photo && previewUrl ? (
            <div className="mt-2">
              <img
                src={previewUrl}
                alt="Capture preview"
                className="max-h-56 w-full rounded-md object-contain bg-black/5"
              />
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                disabled={busy}
                className="mt-2 rounded-md border border-ink/15 px-3 py-1.5 text-xs font-medium hover:bg-ink/5"
              >
                Retake
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              disabled={busy}
              className="mt-2 w-full rounded-md border border-ink/15 py-3 text-sm font-medium hover:bg-ink/5"
            >
              📷 Add a photo
            </button>
          )}
        </div>

        {/* Text / link */}
        <div className="rounded-xl border border-ink/10 bg-paper/50 p-3">
          <label className="text-sm font-medium" htmlFor="capture-text">
            Text or link{' '}
            <span className="font-normal text-muted">
              {photo ? '(optional)' : ''}
            </span>
          </label>
          <textarea
            id="capture-text"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
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

      {cameraOpen && (
        <Suspense fallback={null}>
          <CameraCaptureModal
            title="Capture a photo"
            onCapture={(file) => {
              setPhoto(file);
              setCameraOpen(false);
            }}
            onClose={() => setCameraOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
