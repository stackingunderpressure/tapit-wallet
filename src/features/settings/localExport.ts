import { decrypt, unwrapKData, type Wallet, type EncryptedBlob, type RecoverableEncryptedBlob } from 'tapit-attest';
import { isSovereign } from '../../shared/lib/sovereign.ts';
import { localStore } from '../storage/localStore.ts';
import { buildBackupFile } from './fullBackup.ts';
import { pullCloudCopies, type PullReport } from './pullCloudCopies.ts';

// Download the complete backup file: the wallet plus every record this
// device keeps for it, sealed with the passphrase (fullBackup.ts). Cloud-only
// copies are pulled down first so the file is whole. Ciphertext only: a found
// file is no use without the passphrase. PBKDF2-SHA256 at 210k iterations
// (tapit-attest/src/core/encryption.ts).
//
// Filename embeds the date so multiple exports do not collide.
export async function downloadEncryptedBackup(
  wallet: Wallet,
  ownerId: string,
  passphrase: string,
): Promise<{ records: number; pull: PullReport }> {
  // Check the passphrase opens this device's saved wallet before anything
  // else, so a typo never produces a file sealed under a passphrase nobody
  // remembers. Throws "wrong passphrase" style errors from tapit-attest.
  const saved = await localStore.get(ownerId);
  if (saved) {
    try {
      if (saved.blob.v === 2) unwrapKData(saved.blob as RecoverableEncryptedBlob, passphrase);
      else decrypt(saved.blob as EncryptedBlob, passphrase);
    } catch {
      throw new Error("That isn't this wallet's passphrase. Enter the one you unlock with.");
    }
  }
  // The sovereign build has no cloud copy to pull from.
  const pull: PullReport = isSovereign()
    ? { mediaFetched: 0, mediaFailed: 0, problems: [] }
    : await pullCloudCopies(ownerId, passphrase);
  const { text, records } = await buildBackupFile(wallet, ownerId, passphrase);
  const file = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `tapit-wallet-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { records, pull };
}
