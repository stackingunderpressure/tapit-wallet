import type { Wallet } from 'tapit-attest';

// Trigger a download of the encrypted wallet snapshot as a JSON
// file. The blob is ciphertext — losing the file is not a key leak,
// but a found file is also not useful to an attacker without the
// passphrase. PBKDF2-SHA256 at 210k iterations protects the blob
// at rest (tapit-attest/src/core/encryption.ts).
//
// 5e-iii-b-2 — the downloaded blob is now the v2
// RecoverableEncryptedBlob format. The passphrase-unlock path stays
// identical in effect (PBKDF2 → unwrap K_data → decrypt), so a
// user's saved-to-disk backup is still openable with just the
// blob + their passphrase. K_data is discarded here — the local-
// backup download is an offline copy, NOT a cohort-distribution
// channel; if the operator wants cascade recovery they declare a
// cohort in Settings and the publish flow distributes shares.
//
// Filename embeds the date so multiple exports do not collide.
export async function downloadEncryptedBackup(
  wallet: Wallet,
  passphrase: string,
): Promise<void> {
  const { blob } = await wallet.exportRecoverable(passphrase);
  const json = JSON.stringify(blob, null, 2);
  const file = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `tapit-wallet-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
