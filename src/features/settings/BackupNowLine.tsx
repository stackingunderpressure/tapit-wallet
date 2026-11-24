import { useEffect, useState } from 'react';
import { requestPersistentStorage } from '../storage/persistence.ts';
import { isInstalledApp, isPhoneOrTablet } from '../../shared/lib/appMode.ts';
import { useWallet } from '../wallet-core/useWallet.ts';
import { backupStatusLine } from '../wallet-core/backupBanner.ts';
import { confirmFaceId } from '../face-unlock/confirm.ts';
import { canShareBackup, downloadBackupText, prepareBackup, shareBackupText } from './localExport.ts';

// Top of home, sovereign build: one line saying when the wallet was last
// backed up and whether it changed since, with Save now. The wallet is
// unlocked, so its in-memory passphrase seals the file (Face ID first when it
// is on) - no retyping. The file opens with the passphrase or the recovery key.
//
// Two taps on phones that can share files: the first prepares the encrypted
// file, the second opens the share sheet (iCloud Drive, Files, Proton,
// AirDrop). Phones refuse a share sheet that opens after a wait, and sealing
// the file takes a moment, so it cannot be one tap. Elsewhere it downloads.
// Lazy-loaded from HomeScreen.
export function BackupNowLine() {
  const { wallet, ownerId, passphrase, prefs, updatePrefs } = useWallet();
  const [step, setStep] = useState<'idle' | 'preparing' | 'ready'>('idle');
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = backupStatusLine(prefs);
  const share = canShareBackup();
  const inTab = isPhoneOrTablet() && !isInstalledApp();

  // Ask the browser to keep this wallet's data every time home opens after
  // unlock (it may say no; the answer is not shown here, Settings shows it).
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  async function done() {
    await updatePrefs({ localBackupDownloaded: true, lastFileBackupAt: new Date().toISOString() });
    setStep('idle');
    setText(null);
  }

  async function prepare() {
    setError(null);
    setStep('preparing');
    try {
      await confirmFaceId(ownerId);
      const built = await prepareBackup(wallet, ownerId, passphrase);
      if (share) {
        setText(built.text);
        setStep('ready');
      } else {
        downloadBackupText(built.text);
        await done();
      }
    } catch (err) {
      const cancelled = err instanceof DOMException && err.name === 'NotAllowedError';
      setError(cancelled ? 'Face ID was cancelled. Nothing was saved.' : err instanceof Error ? err.message : 'The backup could not be made.');
      setStep('idle');
    }
  }

  async function send() {
    if (!text) return;
    try {
      if ((await shareBackupText(text)) === 'shared') await done();
    } catch {
      // Share sheet refused: fall back to the download.
      downloadBackupText(text);
      await done();
    }
  }

  return (
    <div
      className={`mt-3 rounded-md border px-3 py-2 text-sm ${
        status.tone === 'warn' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
      }`}
      role="status"
    >
      <div className="flex items-center gap-3">
        <span className="flex-1">{status.text}</span>
        {step === 'ready' ? (
          <button
            type="button"
            onClick={() => void send()}
            className="shrink-0 min-h-[44px] rounded-md bg-fresh-accent-primary px-3 text-xs font-semibold text-fresh-text-inverse"
          >
            Save to…
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void prepare()}
            disabled={step === 'preparing'}
            className="shrink-0 min-h-[44px] rounded-md border border-current px-3 text-xs font-semibold disabled:opacity-50"
          >
            {step === 'preparing' ? 'Sealing…' : 'Save now'}
          </button>
        )}
      </div>
      {step === 'ready' && (
        <p className="mt-1 text-xs">
          Ready. Tap Save to… and pick iCloud Drive, Files or Proton Drive.{' '}
          <button type="button" onClick={() => { downloadBackupText(text!); void done(); }} className="underline">
            Download instead
          </button>
        </p>
      )}
      {error && <p className="mt-1 text-xs" role="alert">{error}</p>}
      {inTab && (
        <p className="mt-2 border-t border-ink/10 pt-2 text-xs">
          Your wallet lives in this browser, and a phone can clear browser data that sits unused for a while. Keep a recent backup saved — that file brings everything back.
        </p>
      )}
    </div>
  );
}
