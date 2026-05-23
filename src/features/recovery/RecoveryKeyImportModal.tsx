import { useState } from 'react';
import { Wallet, type RecoverableEncryptedBlob } from 'tapit-attest';
import type { AnyEncryptedBlob } from '../storage/localStore.ts';
import { walletStore } from '../storage/walletStore.ts';

interface Props {
  ownerId: string;
  storedBlob: AnyEncryptedBlob;
  onRecovered: (wallet: Wallet, passphrase: string) => Promise<void>;
  onClose: () => void;
}

type Phase =
  | { kind: 'entering' }
  | { kind: 'restoring' }
  | { kind: 'saving' }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

const HEX_64 = /^[0-9a-f]{64}$/i;

// Normalize what the operator pasted/typed: strip whitespace, dashes,
// and any other separators they might have used when reading off paper.
function normalize(text: string): string {
  return text.replace(/[\s\-_]+/g, '').toLowerCase();
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Paper-key recovery — the lazy-operator's unconditional last resort.
// Skips the cohort cascade entirely: operator types in the 64-char hex
// K_data they wrote down once when Settings → Recovery key offered
// it, plus a new passphrase to save the recovered wallet under on
// this device. Uses the same Wallet.restoreFromKData primitive the
// ceremony uses, plus this session's exportRecoverableWithKData to
// re-save under the new passphrase while preserving K_data so any
// already-distributed cohort shares stay valid.
//
// This path requires the cloud-mirrored backup blob to already be on
// this device (downloaded by walletStore.load during the locked-phase
// transition). On a fresh device with cloud-sync off, there's no blob
// to restore into — same hard floor that applies to the cohort path.
//
// No transport, no peer involvement, no threshold accumulation. Just
// math: K_data + blob → snapshot → wallet.
export function RecoveryKeyImportModal({
  ownerId,
  storedBlob,
  onRecovered,
  onClose,
}: Props) {
  const isRecoverableBlob = storedBlob.v === 2;

  const [keyInput, setKeyInput] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'entering' });

  async function recover() {
    const normalized = normalize(keyInput);
    if (!HEX_64.test(normalized)) {
      setPhase({
        kind: 'error',
        message: 'Recovery key must be 64 hex characters. Check for missed or extra characters.',
      });
      return;
    }
    if (newPass.length < 8) {
      setPhase({ kind: 'error', message: 'New passphrase must be at least 8 characters.' });
      return;
    }
    if (newPass !== confirmPass) {
      setPhase({ kind: 'error', message: 'Passphrases do not match.' });
      return;
    }
    if (!isRecoverableBlob) {
      setPhase({
        kind: 'error',
        message: 'This wallet was created before recoverable backups existed. The recovery key cannot unlock it — use the original passphrase.',
      });
      return;
    }

    setPhase({ kind: 'restoring' });
    try {
      const kData = hexToBytes(normalized);
      const recoverableBlob: RecoverableEncryptedBlob = storedBlob;
      const restored = await Wallet.restoreFromKData(recoverableBlob, kData);

      setPhase({ kind: 'saving' });
      const blob = await restored.exportRecoverableWithKData(kData, newPass);
      await walletStore.save(ownerId, blob);
      await onRecovered(restored, newPass);
      setPhase({ kind: 'done' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'recovery failed';
      // The most common failure on this path is "decryption failed —
      // wrong K_data" because the operator mistyped a hex character.
      // Surface that in plain English.
      const friendly = /wrong K_data|decryption failed/i.test(message)
        ? 'That key did not decrypt this wallet. Check for transcription errors and try again.'
        : message;
      setPhase({ kind: 'error', message: friendly });
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Recover with recovery key</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        {!isRecoverableBlob && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
            This wallet was created before recoverable backups existed. The
            recovery key path does not apply — use the original passphrase
            to unlock.
          </div>
        )}

        {isRecoverableBlob && phase.kind !== 'done' && (
          <>
            <p className="mt-2 text-sm text-muted">
              Type in the 64-character recovery key you wrote down from
              Settings. Spaces and dashes are okay — they get stripped. Then
              choose a new passphrase to save your wallet under on this
              device.
            </p>

            <label className="mt-4 block">
              <span className="text-sm font-medium">Recovery key</span>
              <textarea
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                rows={3}
                placeholder="64 hex characters"
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono"
              />
            </label>

            <label className="mt-3 block">
              <span className="text-sm font-medium">New passphrase</span>
              <input
                type="password"
                autoComplete="new-password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none"
              />
            </label>

            <label className="mt-3 block">
              <span className="text-sm font-medium">Confirm</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none"
              />
            </label>

            <button
              type="button"
              onClick={() => void recover()}
              disabled={phase.kind === 'restoring' || phase.kind === 'saving'}
              className="mt-5 w-full rounded-md bg-ink py-2.5 text-paper text-sm font-medium disabled:opacity-40"
            >
              {phase.kind === 'restoring'
                ? 'Restoring…'
                : phase.kind === 'saving'
                  ? 'Saving…'
                  : 'Recover'}
            </button>

            {phase.kind === 'error' && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-900">
                {phase.message}
              </div>
            )}
          </>
        )}

        {phase.kind === 'done' && (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
            Your wallet is back. The recovery key still works for next time
            too — keep it safe.
          </div>
        )}
      </div>
    </div>
  );
}
