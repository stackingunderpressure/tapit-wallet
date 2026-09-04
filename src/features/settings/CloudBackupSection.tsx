import { useState } from 'react';
import type { Prefs } from '../storage/prefsStore.ts';

/**
 * CloudBackupSection — the cloud-backup toggle plus the "going sovereign"
 * confirmation the OFF direction requires. Turning cloud backup OFF has
 * irreversible recovery implications (the cohort cascade cannot restore
 * without a cloud blob; only the paper recovery key + an encrypted-file
 * backup remain), so OFF is gated behind an explicit acknowledgment. ON stays
 * one tap.
 */
export function CloudBackupSection({
  prefs,
  updatePrefs,
  save,
}: {
  prefs: Prefs;
  updatePrefs: (next: Partial<Prefs>) => Promise<void>;
  save: () => Promise<unknown>;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const lastSync = prefs.lastRemoteSync
    ? new Date(prefs.lastRemoteSync).toLocaleString()
    : 'never';

  async function toggle() {
    const next = !prefs.cloudSync;
    if (!next) {
      setAcknowledged(false);
      setShowConfirm(true);
      return;
    }
    await updatePrefs({ cloudSync: true });
    try {
      await save();
    } catch {
      // The save outcome is reflected in prefs.lastRemoteSync.
    }
  }

  async function confirmOff() {
    await updatePrefs({ cloudSync: false });
    setShowConfirm(false);
    setAcknowledged(false);
  }

  return (
    <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">Cloud backup</div>
          <p className="mt-1 text-sm text-muted">
            Encrypted snapshot synced to the host. The host stores ciphertext only.
          </p>
          <p className="mt-2 text-xs text-muted">Last sync: {lastSync}</p>
        </div>
        <button
          type="button"
          onClick={toggle}
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

      {showConfirm && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-ink">
            Going sovereign — accept responsibility
          </div>
          <p className="mt-2 text-sm text-ink/80">
            Turning cloud backup OFF means your wallet's encrypted snapshot lives
            only on this device. The host keeps nothing for you. That's the
            strongest form of sovereignty the wallet offers today, and it comes
            with a real cost you need to accept before you flip it.
          </p>
          <ul className="mt-3 list-disc pl-5 text-sm text-ink/80 space-y-1">
            <li>
              If this device is lost or wiped and you have not written down your
              recovery key or downloaded an encrypted-file backup, the wallet is
              gone. There is no math path back.
            </li>
            <li>
              Trusted-helper recovery works by decrypting the cloud blob on a new
              device. With cloud backup off there is no blob to decrypt, so even
              helpers who hold their shares have nothing to restore into — keep a
              downloaded encrypted-file backup so there is.
            </li>
            <li>
              Clearing browser data in this mode wipes the wallet from the device
              permanently if you have no other backup.
            </li>
          </ul>
          <label className="mt-4 flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I understand. I am responsible for my own backup from this point
              forward.
            </span>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void confirmOff()}
              disabled={!acknowledged}
              className="rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
            >
              Turn off cloud backup
            </button>
            <button
              type="button"
              onClick={() => {
                setShowConfirm(false);
                setAcknowledged(false);
              }}
              className="rounded-md border border-ink/15 bg-white py-2 text-sm"
            >
              Keep cloud backup on
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
