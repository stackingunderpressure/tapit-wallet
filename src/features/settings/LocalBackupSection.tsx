import { useState } from 'react';
import type { Wallet } from 'tapit-attest';
import { unwrapKData, type RecoverableEncryptedBlob } from 'tapit-attest';
import type { Prefs } from '../storage/prefsStore.ts';
import { walletStore } from '../storage/walletStore.ts';
import { downloadEncryptedBackup } from './localExport.ts';

/**
 * LocalBackupSection — two offline fallbacks for the day you cannot get back
 * in. The encrypted file is the wallet itself sealed under your passphrase
 * (protects a lost device, not a forgotten passphrase). The recovery key
 * bypasses the passphrase entirely — 64 hex chars you write down once and store
 * somewhere physically safe. Neither key material is persisted in component
 * state beyond the explicit reveal flow.
 */
export function LocalBackupSection({
  wallet,
  ownerId,
  prefs,
  updatePrefs,
}: {
  wallet: Wallet;
  ownerId: string;
  prefs: Prefs;
  updatePrefs: (next: Partial<Prefs>) => Promise<void>;
}) {
  const [showExportForm, setShowExportForm] = useState(false);
  const [passphraseForExport, setPassphraseForExport] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [showKeyForm, setShowKeyForm] = useState(false);
  const [passphraseForKey, setPassphraseForKey] = useState('');
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  async function onExport(e: React.FormEvent) {
    e.preventDefault();
    setExportBusy(true);
    setExportError(null);
    try {
      await downloadEncryptedBackup(wallet, passphraseForExport);
      setPassphraseForExport('');
      setShowExportForm(false);
      // Record that an encrypted-file backup exists so the home-screen nudge
      // retires — this is one of the recovery paths it asks for.
      if (!prefs.localBackupDownloaded) {
        void updatePrefs({ localBackupDownloaded: true });
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExportBusy(false);
    }
  }

  async function onRevealKey(e: React.FormEvent) {
    e.preventDefault();
    setKeyError(null);
    setKeyBusy(true);
    try {
      const stored = await walletStore.load(ownerId);
      if (!stored) {
        throw new Error('No stored wallet — sign out and back in to refresh.');
      }
      if (stored.blob.v !== 2) {
        throw new Error(
          'This wallet uses the legacy backup format and has no recovery key. Save once to upgrade.',
        );
      }
      const kData = unwrapKData(stored.blob as RecoverableEncryptedBlob, passphraseForKey);
      let hex = '';
      for (const b of kData) hex += b.toString(16).padStart(2, '0');
      setRevealedKey(hex);
      setPassphraseForKey('');
      // Revealing the key IS the act of establishing this recovery path, so
      // the home-screen "set up a way back in" nudge retires.
      if (!prefs.recoveryKeySeen) {
        void updatePrefs({ recoveryKeySeen: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'reveal failed';
      const friendly = /wrong passphrase/i.test(message)
        ? 'That passphrase did not unlock the recovery key.'
        : message;
      setKeyError(friendly);
    } finally {
      setKeyBusy(false);
    }
  }

  function hideKey() {
    setRevealedKey(null);
    setShowKeyForm(false);
    setPassphraseForKey('');
    setKeyError(null);
  }

  // 8 chars per group × 4 groups per line × 2 lines = 64 chars.
  function formatKeyForReading(hex: string): string[] {
    const groups: string[] = [];
    for (let i = 0; i < hex.length; i += 8) groups.push(hex.substring(i, i + 8));
    return groups;
  }

  return (
    <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
      <div className="font-medium">Local backup</div>
      <p className="mt-1 text-sm text-muted">
        Two offline fallbacks for the day you cannot get back in. The download is
        the wallet itself encrypted under your passphrase. The recovery key
        bypasses the passphrase entirely — write it down once and store it
        somewhere physically safe.
      </p>

      <div className="mt-4 text-sm font-medium">Encrypted file</div>
      <p className="mt-1 text-xs text-muted">
        You still need your passphrase to open this file on a new device — it
        protects against a lost device, not a forgotten passphrase. For a
        forgotten passphrase, use the recovery key or your trusted helpers.
      </p>
      {!showExportForm ? (
        <button
          type="button"
          onClick={() => setShowExportForm(true)}
          className="mt-2 rounded-md border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5"
        >
          Download local backup
        </button>
      ) : (
        <form onSubmit={onExport} className="mt-3">
          <label className="block text-sm">
            Confirm your passphrase
            <input
              type="password"
              required
              autoFocus
              value={passphraseForExport}
              onChange={(e) => setPassphraseForExport(e.target.value)}
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={exportBusy || passphraseForExport.length === 0}
              className="flex-1 rounded-md bg-ink py-2 text-paper font-medium disabled:opacity-40"
            >
              {exportBusy ? 'Encrypting…' : 'Download'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowExportForm(false);
                setPassphraseForExport('');
                setExportError(null);
              }}
              className="rounded-md border border-ink/15 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
          {exportError && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {exportError}
            </p>
          )}
        </form>
      )}

      <div className="mt-5 border-t border-ink/10 pt-4">
        <div className="text-sm font-medium">Recovery key</div>
        <p className="mt-1 text-sm text-muted">
          A 64-character key that unlocks your wallet without the passphrase.
          Write it down on paper and keep it somewhere physically safe. Anyone
          holding it plus your cloud backup can recover your wallet — treat it
          like a house key.
        </p>

        {!showKeyForm && !revealedKey && (
          <button
            type="button"
            onClick={() => setShowKeyForm(true)}
            className="mt-3 rounded-md border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5"
          >
            Show my recovery key
          </button>
        )}

        {showKeyForm && !revealedKey && (
          <form onSubmit={onRevealKey} className="mt-3">
            <div className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
              The key will appear on screen. Make sure you can write it down
              without anyone looking over your shoulder. Once written, tap Hide
              and store the paper somewhere only you can reach.
            </div>
            <label className="mt-3 block text-sm">
              Confirm your passphrase
              <input
                type="password"
                required
                autoFocus
                value={passphraseForKey}
                onChange={(e) => setPassphraseForKey(e.target.value)}
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={keyBusy || passphraseForKey.length === 0}
                className="flex-1 rounded-md bg-ink py-2 text-paper font-medium disabled:opacity-40"
              >
                {keyBusy ? 'Unwrapping…' : 'Reveal key'}
              </button>
              <button
                type="button"
                onClick={hideKey}
                className="rounded-md border border-ink/15 px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
            {keyError && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {keyError}
              </p>
            )}
          </form>
        )}

        {revealedKey && (
          <div className="mt-3">
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-3">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-sm tracking-wide">
                {formatKeyForReading(revealedKey).map((group, i) => (
                  <div key={i} className="text-center">
                    {group}
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">
              Spaces and dashes are ignored when you type it back in. Read it
              twice, write it twice — small transcription errors mean the key
              will not work.
            </p>
            <button
              type="button"
              onClick={hideKey}
              className="mt-3 w-full rounded-md bg-ink py-2 text-paper text-sm font-medium"
            >
              Hide
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
