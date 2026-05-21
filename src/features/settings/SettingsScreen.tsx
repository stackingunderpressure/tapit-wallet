import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from '../wallet-core/useWallet.ts';
import { supabase } from '../../shared/lib/supabase.ts';
import { downloadEncryptedBackup } from './localExport.ts';

export function SettingsScreen() {
  const { wallet, prefs, updatePrefs, save } = useWallet();
  const navigate = useNavigate();
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [passphraseForExport, setPassphraseForExport] = useState('');
  const [showExportForm, setShowExportForm] = useState(false);

  async function toggleCloudSync() {
    const next = !prefs.cloudSync;
    await updatePrefs({ cloudSync: next });
    // Re-save so the new policy takes effect (and so a freshly-
    // re-enabled cloud-sync immediately pushes a copy).
    if (next) {
      try {
        await save();
      } catch {
        // The save outcome is reflected in prefs.lastRemoteSync.
      }
    }
  }

  async function onExport(e: React.FormEvent) {
    e.preventDefault();
    setExportBusy(true);
    setExportError(null);
    try {
      await downloadEncryptedBackup(wallet, passphraseForExport);
      setPassphraseForExport('');
      setShowExportForm(false);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExportBusy(false);
    }
  }

  async function signOut() {
    await supabase().auth.signOut();
    navigate('/login', { replace: true });
  }

  const lastSync = prefs.lastRemoteSync
    ? new Date(prefs.lastRemoteSync).toLocaleString()
    : 'never';

  return (
    <div className="min-h-screen p-5 max-w-md mx-auto">
      <header className="flex items-center justify-between py-2">
        <Link to="/" className="text-sm text-muted hover:text-ink">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">Settings</h1>
        <span className="w-12" aria-hidden />
      </header>

      <section className="mt-6 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-medium">Cloud backup</div>
            <p className="mt-1 text-sm text-muted">
              Encrypted snapshot synced to the host. The host stores ciphertext
              only.
            </p>
            <p className="mt-2 text-xs text-muted">Last sync: {lastSync}</p>
          </div>
          <button
            type="button"
            onClick={toggleCloudSync}
            aria-pressed={prefs.cloudSync}
            className={`shrink-0 w-12 h-7 rounded-full transition-colors ${
              prefs.cloudSync ? 'bg-accent' : 'bg-ink/15'
            }`}
          >
            <span
              className={`block h-6 w-6 bg-white rounded-full shadow transform transition-transform ${
                prefs.cloudSync ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </section>

      <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
        <div className="font-medium">Auto-lock</div>
        <p className="mt-1 text-sm text-muted">
          Re-prompt for your passphrase after this much inactivity. Lower is
          safer if you set the phone down; higher means fewer interruptions.
        </p>
        <label className="mt-3 block">
          <span className="sr-only">Idle timeout</span>
          <select
            value={prefs.idleTimeoutMs}
            onChange={(e) => updatePrefs({ idleTimeoutMs: Number(e.target.value) })}
            className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
          >
            <option value={5 * 60 * 1000}>5 minutes</option>
            <option value={15 * 60 * 1000}>15 minutes</option>
            <option value={30 * 60 * 1000}>30 minutes (default)</option>
            <option value={60 * 60 * 1000}>1 hour</option>
            <option value={4 * 60 * 60 * 1000}>4 hours</option>
            <option value={0}>Never (until you sign out)</option>
          </select>
        </label>
      </section>

      <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
        <div className="font-medium">Local backup</div>
        <p className="mt-1 text-sm text-muted">
          Download an encrypted copy of your wallet. Keep it somewhere safe —
          a found file is not useful without your passphrase.
        </p>
        {!showExportForm ? (
          <button
            type="button"
            onClick={() => setShowExportForm(true)}
            className="mt-3 rounded-md border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5"
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
      </section>

      <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
        <div className="font-medium">Session</div>
        <button
          type="button"
          onClick={signOut}
          className="mt-3 text-sm text-red-600 hover:underline"
        >
          Sign out
        </button>
      </section>
    </div>
  );
}
