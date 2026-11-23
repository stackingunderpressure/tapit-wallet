import { useEffect, useRef, useState } from 'react';
import { loadFaceUnlock, unlockWithFace, disableFaceUnlock, type FaceUnlockRecord } from './faceUnlock.ts';

// The unlock screen's Face ID button, shown only when Face ID is on. Tries
// Face ID once on its own when the screen opens; typing the passphrase below
// always still works. Lazy-loaded from UnlockPrompt.
export function FaceUnlockButton({ ownerId, onSubmit }: { ownerId: string; onSubmit: (passphrase: string) => Promise<void> }) {
  const [face, setFace] = useState<FaceUnlockRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tried = useRef(false);

  async function run(record: FaceUnlockRecord, quietIfCancelled: boolean) {
    setBusy(true);
    setError(null);
    try {
      const passphrase = await unlockWithFace(record);
      try {
        await onSubmit(passphrase);
      } catch {
        // The passphrase changed since Face ID was set up (a recovery sets a
        // new one). The old seal can never open this wallet, so remove it.
        await disableFaceUnlock(ownerId);
        setFace(null);
        throw new Error('Your passphrase changed since Face ID was set up, so Face ID was turned off. Type your passphrase, then turn Face ID on again in Settings.');
      }
    } catch (err) {
      const cancelled = err instanceof DOMException && err.name === 'NotAllowedError';
      if (!(cancelled && quietIfCancelled)) {
        setError(cancelled ? 'Face ID was cancelled. Try again, or type your passphrase.' : err instanceof Error ? err.message : 'Face ID did not work.');
      }
      setBusy(false);
    }
  }

  useEffect(() => {
    let alive = true;
    void loadFaceUnlock(ownerId).then((r) => {
      if (!alive || !r) return;
      setFace(r);
      if (!tried.current) {
        tried.current = true;
        void run(r, true);
      }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  if (!face && !error) return null;
  return (
    <div className="mt-6">
      {face && (
        <button
          type="button"
          onClick={() => void run(face, false)}
          disabled={busy}
          className="w-full rounded-md bg-ink py-3 text-paper font-medium disabled:opacity-40"
        >
          {busy ? 'Unlocking…' : 'Unlock with Face ID'}
        </button>
      )}
      {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
      {face && <div className="mt-6 text-center text-xs text-muted">or type your passphrase</div>}
    </div>
  );
}
