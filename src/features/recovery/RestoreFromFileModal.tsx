import { useState } from 'react';
import type { Wallet } from 'tapit-attest';
import { walletStore } from '../storage/walletStore.ts';
import { openBackupFile, openBackupFileWithKey, rehomeRecords, writeRestoredRecords, NotABackupError, type OpenedBackup } from '../settings/fullBackup.ts';

const HEX_64 = /^[0-9a-f]{64}$/i;
const normalizeKey = (t: string) => t.replace(/[\s\-_]+/g, '').toLowerCase();
const keyBytes = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], (h) => parseInt(h, 16));

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
  // Forgot the passphrase: open the file with the written-down recovery key
  // and choose a new passphrase for this device.
  const [useKey, setUseKey] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

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
    let saveUnder: string;
    let opener: () => Promise<OpenedBackup>;
    if (useKey) {
      const hex = normalizeKey(keyInput);
      if (!HEX_64.test(hex)) {
        setPhase({ kind: 'error', message: 'The recovery key is 64 characters (0-9 and a-f). Check for a missed or extra character.' });
        return;
      }
      if (newPass.length < 8) {
        setPhase({ kind: 'error', message: 'The new passphrase must be at least 8 characters.' });
        return;
      }
      if (newPass !== confirmPass) {
        setPhase({ kind: 'error', message: 'The two new passphrases do not match.' });
        return;
      }
      saveUnder = newPass;
      opener = () => openBackupFileWithKey(fileText, keyBytes(hex));
    } else {
      if (passphrase.length === 0) {
        setPhase({ kind: 'error', message: 'Enter the passphrase for this backup.' });
        return;
      }
      saveUnder = passphrase;
      opener = () => openBackupFile(fileText, passphrase);
    }
    setPhase({ kind: 'working' });
    try {
      let opened: OpenedBackup;
      try {
        opened = await opener();
      } catch (err) {
        if (err instanceof NotABackupError) {
          throw new Error("That file isn't a wallet backup — pick the tapit-wallet-backup file you downloaded.");
        }
        if (useKey && !(err instanceof Error && /before recovery keys/.test(err.message))) {
          throw new Error('That recovery key did not open this backup. Check it against the one you wrote down.');
        }
        throw err;
      }
      const restored = opened.wallet;
      // A complete backup also carries messages, attachments and the rest.
      // Records already on this device are kept, never overwritten.
      if (opened.records && opened.ownerId) {
        await writeRestoredRecords(rehomeRecords(opened.records, opened.ownerId, ownerId));
      }
      // Save on this device in the recoverable format. When the file carries
      // the wallet's K_data, keep it: the written-down recovery key and any
      // trusted-helper shares stay valid. An older file gets a fresh one.
      const v2 = opened.kData
        ? await restored.exportRecoverableWithKData(opened.kData, saveUnder)
        : (await restored.exportRecoverable(saveUnder)).blob;
      await walletStore.save(ownerId, v2);
      await onRecovered(restored, saveUnder);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'restore failed';
      const friendly = !useKey && /decrypt|password|passphrase|MAC/i.test(message)
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
          Opens with the passphrase, or with your written-down recovery key
          if you forgot it (backup files downloaded after this update).
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

        {!useKey ? (
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
        ) : (
          <>
            <label className="mt-3 block">
              <span className="text-sm font-medium">Your recovery key</span>
              <textarea
                rows={2}
                autoComplete="off"
                spellCheck={false}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="64 characters, spaces are fine"
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none font-mono"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-medium">New passphrase for this device</span>
              <input type="password" autoComplete="new-password" value={newPass} onChange={(e) => setNewPass(e.target.value)} className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none" />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-medium">New passphrase again</span>
              <input type="password" autoComplete="new-password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none" />
            </label>
          </>
        )}
        <button
          type="button"
          onClick={() => { setUseKey((v) => !v); setPhase({ kind: 'idle' }); }}
          className="mt-2 text-xs text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          {useKey ? 'I have the passphrase' : 'Forgot the passphrase? Use your recovery key'}
        </button>

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
