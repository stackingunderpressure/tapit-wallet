// Decides whether to nudge the operator to set up a way back into their
// wallet. The recovery audit (2026-06-03) found the critical gap: a
// nontechnical user who never opens Settings ends up with cloud backup
// only, is never told the recovery key or trusted-helper cohort exist,
// and if they lose the device AND forget the passphrase the wallet is
// unrecoverable. Cloud backup alone does NOT save them — the cloud blob
// is encrypted under the forgotten passphrase.
//
// "Secured" means the operator has established at least one recovery path
// that survives a forgotten passphrase OR a lost device:
//   - revealed (wrote down) the recovery key, OR
//   - downloaded an encrypted-file backup, OR
//   - declared a recovery cohort (trusted helpers).
//
// Note the recovery key and the cohort both still need the cloud blob to
// restore into, and the encrypted file still needs the passphrase — no
// single path is unconditional, which is why the post-setup step and the
// Guide teach the combination. But having taken ANY of these actions
// means the operator has engaged with recovery rather than sailing past
// it blind, so the nudge has done its job and retires.

export interface BackupNudgeInput {
  recoveryKeySeen: boolean;
  localBackupDownloaded: boolean;
  hasCohort: boolean;
}

export interface BackupNudge {
  text: string;
  cta: string;
}

export function backupNudge(input: BackupNudgeInput): BackupNudge | null {
  if (input.recoveryKeySeen || input.localBackupDownloaded || input.hasCohort) {
    return null;
  }
  return {
    text:
      "You haven't set up a way back into this wallet yet. If you forget your passphrase or lose this device, cloud backup alone can't bring you back. Take two minutes to secure it.",
    cta: 'Set up a way back in',
  };
}
