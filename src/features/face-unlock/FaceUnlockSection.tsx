import { useEffect, useState } from 'react';
import { useWallet } from '../wallet-core/useWallet.ts';
import { enableFaceUnlock, disableFaceUnlock, loadFaceUnlock, faceUnlockSupported } from './faceUnlock.ts';

// Settings: turn Face ID on or off. Lazy-loaded from SettingsScreen.
export function FaceUnlockSection() {
  const { ownerId, wallet, passphrase } = useWallet();
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadFaceUnlock(ownerId).then((r) => setOn(!!r));
  }, [ownerId]);

  async function turnOn() {
    setBusy(true);
    setMessage(null);
    try {
      await enableFaceUnlock(ownerId, wallet.identity, passphrase);
      setOn(true);
      setMessage('Face ID is on. It opens the wallet and confirms every signature.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Face ID could not be set up.');
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    await disableFaceUnlock(ownerId);
    setOn(false);
    setMessage('Face ID is off. The wallet asks for your passphrase again.');
  }

  return (
    <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
      <div className="font-medium">Face ID</div>
      <p className="mt-1 text-sm text-muted">
        Open the wallet with Face ID instead of typing your passphrase, and
        confirm every signature with it. A copy of your passphrase is sealed on
        this device and only Face ID can open it. Nothing is sent anywhere, and
        typing your passphrase always still works.
      </p>
      {!faceUnlockSupported() ? (
        <p className="mt-3 text-sm text-muted">This browser can&apos;t use Face ID for the wallet.</p>
      ) : on === null ? null : on ? (
        <button type="button" onClick={() => void turnOff()} className="mt-3 rounded-md border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5">
          Turn off Face ID
        </button>
      ) : (
        <button type="button" onClick={() => void turnOn()} disabled={busy} className="mt-3 rounded-md bg-ink px-4 py-2 text-sm text-paper font-medium disabled:opacity-40">
          {busy ? 'Waiting for Face ID…' : 'Turn on Face ID'}
        </button>
      )}
      {message && <p className="mt-2 text-sm" role="status">{message}</p>}
    </section>
  );
}
