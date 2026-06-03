import { useState } from 'react';
import { Wallet, type EncryptedBlob } from 'tapit-attest';
import { walletStore } from '../storage/walletStore.ts';

// Restore-from-encrypted-file flow (recovery-hardening arc, part 4,
// 2026-06-03). Closes the dead-end the audit found: Settings → Local
// backup lets the operator DOWNLOAD an encrypted backup file, but there
// was no way to USE it. On a fresh device where no cloud blob loaded
// (cloud-sync was off, or this is a different device entirely), the
// first-login screen offered only "create a new wallet" — a returning
// operator with their backup file and passphrase had no path in.
//
// This takes the downloaded tapit-wallet-backup-*.json (an EncryptedBlob
// the host never holds), decrypts it with the operator's passphrase via
// Wallet.restore, then re-saves locally in the v2 recoverable format so
// the restored wallet regains a recovery key + cloud-backup path on this
// device. Lands via the same onRecovered the social-recovery and
// paper-key flows use.
//
// This is the passphrase-protected lost-DEVICE path. It does NOT help a
// forgotten passphrase — that's what the recovery key and trusted-helper
// cohort are for. The copy says so plainly.

interface Props {
  ownerId: string;
  onRecovered: (wallet: Wallet, passphrase: string) => Promise<void>;
  onClose: () => void;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'error'; message: string };

export function RestoreFromFileModal({ ownerId, onRecovered, onClose }: Props) {
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPhase({ kind: 'idle' });
    try {
      setFileText(await file.text());
    } catch {
      setPhase({ kind: 'error', message: 'Could not read that file.' });
    }
  }

  async function restore() {
    if (!fileText) {
      setPhase({ kind: 'error', message: 'Choose your backup file first.' });
      return;
    }
    if (passphrase.length === 0) {
      setPhase({ kind: 'error', message: 'Enter the passphrase for this backup.' });
      return;
    }
    setPhase({ kind: 'working' });
    try {
      let blob: EncryptedBlob;
      try {
        blob = JSON.parse(fileText) as EncryptedBlob;
      } catch {
        throw new Error("That file isn't a wallet backup — pick the tapit-wallet-backup file you downloaded.");
      }
      const restored = await Wallet.restore(blob, passphrase);
      // Re-save in the v2 recoverable format so the restored wallet has a
      // recovery key + cloud path on this device going forward.
      const { blob: v2 } = await restored.exportRecoverable(passphrase);
      await walletStore.save(ownerId, v2);
      await onRecovered(restored, passphrase);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'restore failed';
      const friendly = /decrypt|password|passphrase|MAC/i.test(message)
        ? 'That passphrase did not open this backup. Check it and try again.'
        : message;
      setPhase({ kind: 'error', message: friendly });
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Restore from a backup file</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted hover:text-ink">
            Close
          </button>
        </div>

        <p className="mt-2 text-sm text-muted">
          If you saved an encrypted backup file from another device
          (Settings → Local backup), pick it here and enter the passphrase
          you used on that device. This brings the wallet back onto this
          device.
        </p>
        <p className="mt-2 text-xs text-muted">
          This needs the passphrase — it restores a lost device, not a
          forgotten passphrase. For a forgotten passphrase, use your written
          recovery key or your trusted helpers instead.
        </p>

        <label className="mt-4 block">
          <span className="text-sm font-medium">Backup file</span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => void onFile(e)}
            className="mt-1 block w-full text-sm"
          />
        </label>
        {fileName && (
          <p className="mt-1 text-xs text-muted">Selected: {fileName}</p>
        )}

        <label className="mt-3 block">
          <span className="text-sm font-medium">Passphrase for this backup</span>
          <input
            type="password"
            autoComplete="current-password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none"
          />
        </label>

        <button
          type="button"
          onClick={() => void restore()}
          disabled={phase.kind === 'working'}
          className="mt-5 w-full rounded-md bg-ink py-2.5 text-paper text-sm font-medium disabled:opacity-40"
        >
          {phase.kind === 'working' ? 'Restoring…' : 'Restore my wallet'}
        </button>

        {phase.kind === 'error' && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-900">
            {phase.message}
          </div>
        )}
      </div>
    </div>
  );
}
