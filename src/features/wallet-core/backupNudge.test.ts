import { describe, expect, test } from 'vitest';
import { backupNudge } from './backupNudge.ts';

describe('backupNudge', () => {
  test('nudges when no recovery path has been established', () => {
    const n = backupNudge({
      recoveryKeySeen: false,
      localBackupDownloaded: false,
      hasCohort: false,
    });
    expect(n).not.toBeNull();
    expect(n?.cta).toMatch(/way back in/i);
  });

  test('retires once the recovery key has been seen', () => {
    expect(
      backupNudge({
        recoveryKeySeen: true,
        localBackupDownloaded: false,
        hasCohort: false,
      }),
    ).toBeNull();
  });

  test('retires once an encrypted file backup was downloaded', () => {
    expect(
      backupNudge({
        recoveryKeySeen: false,
        localBackupDownloaded: true,
        hasCohort: false,
      }),
    ).toBeNull();
  });

  test('retires once a cohort is declared', () => {
    expect(
      backupNudge({
        recoveryKeySeen: false,
        localBackupDownloaded: false,
        hasCohort: true,
      }),
    ).toBeNull();
  });

  test('any single path retires it (all three set)', () => {
    expect(
      backupNudge({
        recoveryKeySeen: true,
        localBackupDownloaded: true,
        hasCohort: true,
      }),
    ).toBeNull();
  });
});
