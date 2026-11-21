import { Wallet } from 'tapit-attest';

// "Test my backup" — opens a downloaded wallet backup in memory with the
// passphrase, to prove it works, and writes NOTHING: no IndexedDB, no cloud,
// no prefs. The point is that a person can find out a backup is unusable
// today, not on the day they need it (SOVEREIGN_SYNC_PLAN.md, section 4).
//
// It reports the identity the backup belongs to, so the person can match it
// against their own wallet by eye.

export type BackupCheck =
  | { ok: true; identity: string }
  | { ok: false; reason: 'not-a-backup' | 'wrong-passphrase' | 'damaged' };

export async function checkBackupFile(text: string, passphrase: string): Promise<BackupCheck> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not-a-backup' };
  }
  if (!parsed || typeof parsed !== 'object' || !('v' in parsed)) {
    return { ok: false, reason: 'not-a-backup' };
  }
  try {
    const wallet = await Wallet.restore(parsed as Parameters<typeof Wallet.restore>[0], passphrase);
    return { ok: true, identity: wallet.identity };
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    // The same wording the restore screen uses to tell a wrong passphrase
    // from a broken file.
    if (/decrypt|password|passphrase|MAC/i.test(message)) {
      return { ok: false, reason: 'wrong-passphrase' };
    }
    return { ok: false, reason: 'damaged' };
  }
}

export const BACKUP_CHECK_MESSAGE: Record<Exclude<BackupCheck, { ok: true; identity: string }>['reason'], string> = {
  'not-a-backup': "That file isn't a wallet backup. Pick the tapit-wallet-backup file you downloaded.",
  'wrong-passphrase': 'That passphrase did not open this backup. Check it and try again.',
  damaged: 'This file is damaged or was changed after it was saved, so it cannot be opened. Make a new backup from this wallet.',
};
