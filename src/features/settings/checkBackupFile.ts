import { openBackupFile, NotABackupError } from './fullBackup.ts';

// "Test my backup" — opens a downloaded wallet backup in memory with the
// passphrase, to prove it works, and writes NOTHING: no IndexedDB, no cloud,
// no prefs. The point is that a person can find out a backup is unusable
// today, not on the day they need it (SOVEREIGN_SYNC_PLAN.md, section 4).
//
// It reports the identity the backup belongs to, so the person can match it
// against their own wallet by eye, and how many other records the file holds
// (null for an old wallet-only file, which is worth knowing before Supabase
// is switched off).

export type BackupCheck =
  | { ok: true; identity: string; records: number | null }
  | { ok: false; reason: 'not-a-backup' | 'wrong-passphrase' | 'damaged' };

export async function checkBackupFile(text: string, passphrase: string): Promise<BackupCheck> {
  try {
    const opened = await openBackupFile(text, passphrase);
    return { ok: true, identity: opened.wallet.identity, records: opened.records?.length ?? null };
  } catch (err) {
    if (err instanceof NotABackupError) return { ok: false, reason: 'not-a-backup' };
    const message = err instanceof Error ? err.message : '';
    // The same wording the restore screen uses to tell a wrong passphrase
    // from a broken file.
    if (/decrypt|password|passphrase|MAC/i.test(message)) {
      return { ok: false, reason: 'wrong-passphrase' };
    }
    return { ok: false, reason: 'damaged' };
  }
}

export const BACKUP_CHECK_MESSAGE: Record<Extract<BackupCheck, { ok: false }>['reason'], string> = {
  'not-a-backup': "That file isn't a wallet backup. Pick the tapit-wallet-backup file you downloaded.",
  'wrong-passphrase': 'That passphrase did not open this backup. Check it and try again.',
  damaged: 'This file is damaged or was changed after it was saved, so it cannot be opened. Make a new backup from this wallet.',
};
