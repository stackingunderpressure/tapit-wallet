import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Wallet } from 'tapit-attest';

const store = new Map<string, unknown>();
vi.mock('../../shared/lib/idb.ts', () => ({
  idb: {
    get: async (k: string) => store.get(k),
    put: async (k: string, v: unknown) => { store.set(k, v); },
    delete: async (k: string) => { store.delete(k); },
    entries: async () => [...store.entries()].sort(([a], [b]) => (a < b ? -1 : 1)),
  },
}));

import {
  buildBackupFile, openBackupFile, rehomeRecords, writeRestoredRecords,
  serializeRecords, parseRecords, NotABackupError,
  openBackupFileWithKey, NoRecoveryKeyPathError,
} from './fullBackup.ts';
import { checkBackupFile } from './checkBackupFile.ts';

const OLD = '11111111-aaaa-4bbb-8ccc-000000000001';
const NEW = '22222222-aaaa-4bbb-8ccc-000000000002';
const PASS = 'correct horse battery';

function seedDevice() {
  store.set(`wallet:${OLD}`, { blob: { v: 1 }, updated_at: 'x' }); // old-format wallet: version 2 file
  store.set(`chat-threads:${OLD}`, { v: 1, ciphertext: 'aa' });
  store.set(`media:${OLD}:${'ab'.repeat(32)}`, { blob: { v: 1 }, mime: 'image/png', byteLength: 3, stored_at: 't' });
  store.set(`prefs:${OLD}`, { theme: 'dark', localBackupDownloaded: true });
  store.set(`announcement-outbox-index:${OLD}`, [`announcement-outbox:${OLD}:peer:env1`]);
  store.set('circlePhrase:v1', { vault1: { receivedAt: '2026-11-01T00:00:00Z' } });
}

describe('complete backup file', () => {
  beforeEach(() => store.clear());

  it('holds the wallet and every other record on the device, and opens back to the same data', async () => {
    seedDevice();
    const wallet = Wallet.generate();
    const { text, records } = await buildBackupFile(wallet, OLD, PASS);
    expect(records).toBe(5); // everything except the wallet record itself
    const opened = await openBackupFile(text, PASS);
    expect(opened.wallet.identity).toBe(wallet.identity);
    expect(opened.ownerId).toBe(OLD);
    expect(new Map(opened.records!)).toEqual(new Map([...store].filter(([k]) => !k.startsWith('wallet:'))));
  });

  it('never writes readable data into the file: prefs and keys are sealed', async () => {
    seedDevice();
    const { text } = await buildBackupFile(Wallet.generate(), OLD, PASS);
    expect(text).not.toContain('localBackupDownloaded');
    expect(text).not.toContain('chat-threads');
    expect(text).not.toContain('image/png');
  });

  it('refuses the wrong passphrase', async () => {
    seedDevice();
    const { text } = await buildBackupFile(Wallet.generate(), OLD, PASS);
    await expect(openBackupFile(text, 'nope')).rejects.toThrow();
    expect(await checkBackupFile(text, 'nope')).toEqual({ ok: false, reason: 'wrong-passphrase' });
  });

  it('refuses a file whose data part was changed', async () => {
    seedDevice();
    const { text } = await buildBackupFile(Wallet.generate(), OLD, PASS);
    const f = JSON.parse(text);
    const c = f.data.ciphertext as string;
    f.data.ciphertext = (c[0] === '0' ? '1' : '0') + c.slice(1);
    expect((await checkBackupFile(JSON.stringify(f), PASS)).ok).toBe(false);
  });

  it('still opens an old wallet-only file, and says it holds no other records', async () => {
    const wallet = Wallet.generate();
    const old = JSON.stringify(await wallet.exportEncrypted(PASS));
    const opened = await openBackupFile(old, PASS);
    expect(opened.records).toBeNull();
    expect(await checkBackupFile(old, PASS)).toEqual({ ok: true, identity: wallet.identity, records: null, recoveryKeyOpens: false });
  });

  it('reports the record count for a complete file', async () => {
    seedDevice();
    const wallet = Wallet.generate();
    const { text } = await buildBackupFile(wallet, OLD, PASS);
    expect(await checkBackupFile(text, PASS)).toEqual({ ok: true, identity: wallet.identity, records: 5, recoveryKeyOpens: false });
  });

  it('calls a non-backup a non-backup', async () => {
    await expect(openBackupFile('hello', PASS)).rejects.toBeInstanceOf(NotABackupError);
    await expect(openBackupFile('{"format":"other"}', PASS)).rejects.toBeInstanceOf(NotABackupError);
  });

  it('moves records to a new owner, including keys stored inside other records', () => {
    const moved = new Map(rehomeRecords([
      [`prefs:${OLD}`, { theme: 'dark' }],
      [`announcement-outbox-index:${OLD}`, [`announcement-outbox:${OLD}:peer:env1`]],
      ['circlePhrase:v1', { a: 1 }],
    ], OLD, NEW));
    expect(moved.get(`prefs:${NEW}`)).toEqual({ theme: 'dark' });
    expect(moved.get(`announcement-outbox-index:${NEW}`)).toEqual([`announcement-outbox:${NEW}:peer:env1`]);
    expect(moved.get('circlePhrase:v1')).toEqual({ a: 1 });
    expect([...moved.keys()].some((k) => k.includes(OLD))).toBe(false);
  });

  it('restores into an empty device and never overwrites a record already there', async () => {
    store.set(`prefs:${NEW}`, { theme: 'light' });
    const result = await writeRestoredRecords([
      [`prefs:${NEW}`, { theme: 'dark' }],
      [`chat-threads:${NEW}`, { v: 1 }],
      [`wallet:${NEW}`, { should: 'not be written' }],
    ]);
    expect(result).toEqual({ written: 1, kept: 1 });
    expect(store.get(`prefs:${NEW}`)).toEqual({ theme: 'light' });
    expect(store.get(`chat-threads:${NEW}`)).toEqual({ v: 1 });
    expect(store.has(`wallet:${NEW}`)).toBe(false);
  });

  it('carries bytes and dates through the file, and refuses values it cannot carry', () => {
    const recs: Array<[string, unknown]> = [['k', { b: new Uint8Array([0, 255, 7]), d: new Date('2026-01-02T03:04:05Z') }]];
    const back = parseRecords(serializeRecords(recs));
    expect(back[0]?.[1]).toEqual({ b: new Uint8Array([0, 255, 7]), d: new Date('2026-01-02T03:04:05Z') });
    expect(() => serializeRecords([['k', new Map()]])).toThrow(/nothing was saved/);
  });
});

describe('version 3: the recovery key opens the backup file too', () => {
  beforeEach(() => store.clear());

  async function v3Device() {
    const wallet = Wallet.generate();
    const { blob, kData } = await wallet.exportRecoverable(PASS);
    store.set(`wallet:${OLD}`, { blob, updated_at: 'x' });
    store.set(`chat-threads:${OLD}`, { v: 1, ciphertext: 'aa' });
    return { wallet, kData };
  }

  it('opens with the passphrase and with the recovery key, to the same wallet and records', async () => {
    const { wallet, kData } = await v3Device();
    const { text, recoveryKeyOpens } = await buildBackupFile(wallet, OLD, PASS);
    expect(recoveryKeyOpens).toBe(true);
    expect(JSON.parse(text).version).toBe(3);
    const byPass = await openBackupFile(text, PASS);
    const byKey = await openBackupFileWithKey(text, kData);
    expect(byPass.wallet.identity).toBe(wallet.identity);
    expect(byKey.wallet.identity).toBe(wallet.identity);
    expect(byKey.records).toEqual(byPass.records);
    expect(byKey.records).toEqual([[`chat-threads:${OLD}`, { v: 1, ciphertext: 'aa' }]]);
  });

  it("keeps the wallet's existing K_data, so the written-down key stays valid", async () => {
    const { wallet, kData } = await v3Device();
    const { text } = await buildBackupFile(wallet, OLD, PASS);
    expect((await openBackupFile(text, PASS)).kData).toEqual(kData);
  });

  it('refuses a wrong recovery key and a wrong passphrase', async () => {
    const { wallet } = await v3Device();
    const { text } = await buildBackupFile(wallet, OLD, PASS);
    await expect(openBackupFileWithKey(text, new Uint8Array(32).fill(9))).rejects.toThrow();
    expect(await checkBackupFile(text, 'nope')).toEqual({ ok: false, reason: 'wrong-passphrase' });
  });

  it('refuses to build with a passphrase that does not open this wallet', async () => {
    const { wallet } = await v3Device();
    await expect(buildBackupFile(wallet, OLD, 'nope')).rejects.toThrow();
  });

  it('says plainly when an older file needs the passphrase', async () => {
    seedDevice(); // v1-style saved blob: version 2 file
    const { text, recoveryKeyOpens } = await buildBackupFile(Wallet.generate(), OLD, PASS);
    expect(recoveryKeyOpens).toBe(false);
    await expect(openBackupFileWithKey(text, new Uint8Array(32))).rejects.toBeInstanceOf(NoRecoveryKeyPathError);
  });

  it('Test my backup reports that the recovery key opens it', async () => {
    const { wallet } = await v3Device();
    const { text } = await buildBackupFile(wallet, OLD, PASS);
    expect(await checkBackupFile(text, PASS)).toMatchObject({ ok: true, identity: wallet.identity, records: 1, recoveryKeyOpens: true });
  });
});
