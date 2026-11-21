import { describe, expect, it, vi } from 'vitest';
import { Wallet } from 'tapit-attest';
import { checkBackupFile, BACKUP_CHECK_MESSAGE } from './checkBackupFile.ts';

// Real encrypted backups, made with the same call the Settings export uses.
async function backupOf(passphrase: string) {
  const wallet = Wallet.generate();
  const blob = await wallet.exportEncrypted(passphrase);
  return { text: JSON.stringify(blob, null, 2), identity: wallet.identity };
}

describe('checkBackupFile', () => {
  it('opens a good backup with the right passphrase and reports its identity', async () => {
    const { text, identity } = await backupOf('correct horse battery');
    const result = await checkBackupFile(text, 'correct horse battery');
    expect(result).toEqual({ ok: true, identity });
  });

  it('refuses the wrong passphrase, and says so in plain words', async () => {
    const { text } = await backupOf('correct horse battery');
    const result = await checkBackupFile(text, 'not the passphrase');
    expect(result).toEqual({ ok: false, reason: 'wrong-passphrase' });
    expect(BACKUP_CHECK_MESSAGE['wrong-passphrase']).toMatch(/did not open/);
  });

  it('refuses something that is not a backup at all', async () => {
    expect(await checkBackupFile('hello', 'x')).toEqual({ ok: false, reason: 'not-a-backup' });
    expect(await checkBackupFile('[1,2,3]', 'x')).toEqual({ ok: false, reason: 'not-a-backup' });
    expect(await checkBackupFile('{}', 'x')).toEqual({ ok: false, reason: 'not-a-backup' });
  });

  it('refuses a backup that was changed after it was saved', async () => {
    const { text } = await backupOf('correct horse battery');
    const parsed = JSON.parse(text);
    // Flip one hex digit of the ciphertext.
    const field = Object.keys(parsed).find(k => typeof parsed[k] === 'string' && /^[0-9a-f]{32,}$/i.test(parsed[k]) && k !== 'salt' && k !== 'iv');
    expect(field).toBeDefined();
    const s = parsed[field!] as string;
    parsed[field!] = (s[0] === '0' ? '1' : '0') + s.slice(1);
    const result = await checkBackupFile(JSON.stringify(parsed), 'correct horse battery');
    expect(result.ok).toBe(false);
  });

  it('writes nothing: any storage access during a check would fail the test', async () => {
    const { text } = await backupOf('correct horse battery');
    const touched = vi.fn();
    vi.doMock('../storage/localStore.ts', () => ({ localStore: { put: touched, get: touched, clear: touched } }));
    vi.doMock('../storage/walletStore.ts', () => ({ walletStore: { save: touched, load: touched } }));
    const { checkBackupFile: check } = await import('./checkBackupFile.ts');
    await check(text, 'correct horse battery');
    expect(touched).not.toHaveBeenCalled();
    vi.doUnmock('../storage/localStore.ts');
    vi.doUnmock('../storage/walletStore.ts');
  });
});
