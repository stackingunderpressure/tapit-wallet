import { Wallet, encrypt, decrypt, unwrapKData, type EncryptedBlob, type RecoverableEncryptedBlob } from 'tapit-attest';
import { idb } from '../../shared/lib/idb.ts';
import { localStore } from '../storage/localStore.ts';

// The complete backup file (SOVEREIGN_SYNC_PLAN.md, P1). One file holds the
// wallet AND everything else this device keeps for it: messages, inbox,
// attachments, shared notes, the secrets ledger, circle phrases, request
// history, prefs, queues. It exists so Supabase can be switched off without
// losing anything that lived only there.
//
//   { format: 'tapit-backup', version: 2, created_at, owner_id,
//     wallet: <EncryptedBlob, the same export the old file held>,
//     data:   <EncryptedBlob of every IndexedDB record> }
//
// Version 3 (2026-11-23) lets the paper recovery key open the file too, not
// only the passphrase. The wallet part is the wallet's own recoverable blob
// (K_data wrapped under the passphrase, the snapshot sealed under K_data,
// REUSING this wallet's existing K_data so the written-down key and any
// trusted-helper shares stay valid), and the data part is sealed under a key
// derived from that same K_data:
//
//   { format: 'tapit-backup', version: 3, created_at, owner_id,
//     wallet: <RecoverableEncryptedBlob>,
//     data:   { alg: 'aes-256-gcm/hkdf-kdata', iv, ciphertext } }
//
// Passphrase -> unwrap K_data -> both parts. Recovery key = K_data -> both
// parts. A wallet still on the old v1 format has no K_data, so its file stays
// version 2 (passphrase only), as below.
//
// Both version-2 parts are sealed with the passphrase on this device. Some records are
// plaintext in IndexedDB (prefs, request history), so the data part must be
// encrypted as a whole, never copied out as is. A file from before this format
// (a bare wallet EncryptedBlob) still opens: it simply has no data part.

export const BACKUP_FORMAT = 'tapit-backup';
export const BACKUP_VERSION = 2;

/** The wallet record is carried by the `wallet` part; restoring re-saves it. */
const WALLET_KEY_PREFIX = 'wallet:';

export interface BackupFileV2 {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  created_at: string;
  owner_id: string;
  wallet: EncryptedBlob;
  data: EncryptedBlob;
}

export interface BackupFileV3 {
  format: typeof BACKUP_FORMAT;
  version: 3;
  created_at: string;
  owner_id: string;
  wallet: RecoverableEncryptedBlob;
  data: { alg: typeof DATA_ALG; iv: string; ciphertext: string };
}

const DATA_ALG = 'aes-256-gcm/hkdf-kdata';
const DATA_INFO = new TextEncoder().encode('tapit-backup-data-v3');

export interface OpenedBackup {
  wallet: Wallet;
  /** The wallet's K_data, when the file carries it (version 3). Restoring
   *  re-saves under it so the recovery key and helper shares stay valid. */
  kData: Uint8Array | null;
  /** null for an old wallet-only file. */
  records: Array<[string, unknown]> | null;
  ownerId: string | null;
  createdAt: string | null;
}

// IndexedDB holds structured-clone values; a few may carry bytes or dates.
// Tag them so they survive JSON, and refuse anything else that JSON would
// silently mangle, so a backup can never quietly drop data.
function replacer(this: unknown, key: string, value: unknown): unknown {
  const raw = (this as Record<string, unknown>)[key];
  if (raw instanceof Uint8Array) return { $u8: Array.from(raw, (b) => b.toString(16).padStart(2, '0')).join('') };
  if (raw instanceof Date) return { $date: raw.toISOString() };
  if (raw instanceof ArrayBuffer || raw instanceof Map || raw instanceof Set || (typeof Blob !== 'undefined' && raw instanceof Blob)) {
    throw new Error(`Backup cannot carry the value at "${key}" yet; nothing was saved.`);
  }
  return value;
}

function reviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    const keys = Object.keys(o);
    if (keys.length === 1 && typeof o.$u8 === 'string') {
      const hex = o.$u8;
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      return out;
    }
    if (keys.length === 1 && typeof o.$date === 'string') return new Date(o.$date);
  }
  return value;
}

export function serializeRecords(records: Array<[string, unknown]>): string {
  return JSON.stringify(records, replacer);
}

export function parseRecords(text: string): Array<[string, unknown]> {
  const parsed: unknown = JSON.parse(text, reviver);
  if (!Array.isArray(parsed) || !parsed.every((r) => Array.isArray(r) && r.length === 2 && typeof r[0] === 'string')) {
    throw new Error('damaged: backup data is not a list of records');
  }
  return parsed as Array<[string, unknown]>;
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (s: string) => new Uint8Array((s.match(/../g) ?? []).map((h) => parseInt(h, 16)));

async function dataKey(kData: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', kData as BufferSource, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32) as BufferSource, info: DATA_INFO as BufferSource },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function sealData(text: string, kData: Uint8Array): Promise<BackupFileV3['data']> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, await dataKey(kData), new TextEncoder().encode(text));
  return { alg: DATA_ALG, iv: hex(iv), ciphertext: hex(new Uint8Array(ct)) };
}

async function openData(data: BackupFileV3['data'], kData: Uint8Array): Promise<string> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unhex(data.iv) as BufferSource }, await dataKey(kData), unhex(data.ciphertext) as BufferSource);
  return new TextDecoder().decode(pt);
}

/** Build the complete backup file's text from what is on this device now. */
export async function buildBackupFile(wallet: Wallet, ownerId: string, passphrase: string): Promise<{ text: string; records: number; recoveryKeyOpens: boolean }> {
  const all = await idb.entries();
  const records = all.filter(([k]) => !k.startsWith(WALLET_KEY_PREFIX));
  const saved = await localStore.get(ownerId);
  if (saved?.blob.v === 2) {
    // Same K_data as the saved wallet: the written-down key keeps working.
    const { blob, kData } = await wallet.exportRecoverableReuseKData(saved.blob as RecoverableEncryptedBlob, passphrase);
    const file3: BackupFileV3 = {
      format: BACKUP_FORMAT,
      version: 3,
      created_at: new Date().toISOString(),
      owner_id: ownerId,
      wallet: blob,
      data: await sealData(serializeRecords(records), kData),
    };
    return { text: JSON.stringify(file3), records: records.length, recoveryKeyOpens: true };
  }
  const file: BackupFileV2 = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    created_at: new Date().toISOString(),
    owner_id: ownerId,
    wallet: await wallet.exportEncrypted(passphrase),
    data: encrypt(serializeRecords(records), passphrase),
  };
  return { text: JSON.stringify(file), records: records.length, recoveryKeyOpens: false };
}

function isV2(x: unknown): x is BackupFileV2 {
  const o = x as Partial<BackupFileV2> | null;
  return !!o && typeof o === 'object' && o.format === BACKUP_FORMAT && o.version === BACKUP_VERSION
    && !!o.wallet && !!o.data && typeof o.owner_id === 'string';
}

function isV3(x: unknown): x is BackupFileV3 {
  const o = x as Partial<BackupFileV3> | null;
  return !!o && typeof o === 'object' && o.format === BACKUP_FORMAT && o.version === 3
    && !!o.wallet && o.data?.alg === DATA_ALG && typeof o.owner_id === 'string';
}

export class NotABackupError extends Error {}

/** A file made before the recovery key could open backups. */
export class NoRecoveryKeyPathError extends Error {
  constructor() {
    super('This backup was made before recovery keys could open backup files, so it needs the passphrase. New backups open with either.');
  }
}

/** Open a backup file with the paper recovery key (the wallet's K_data)
 *  instead of the passphrase. Writes nothing. */
export async function openBackupFileWithKey(text: string, kData: Uint8Array): Promise<OpenedBackup> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new NotABackupError('not json');
  }
  if (!isV3(parsed)) {
    if (isV2(parsed) || (parsed && typeof parsed === 'object' && 'v' in parsed)) throw new NoRecoveryKeyPathError();
    throw new NotABackupError('unknown shape');
  }
  const wallet = await Wallet.restoreFromKData(parsed.wallet, kData);
  const records = parseRecords(await openData(parsed.data, kData));
  return { wallet, kData, records, ownerId: parsed.owner_id, createdAt: parsed.created_at };
}

/** Open a backup file in memory. Writes nothing. Throws NotABackupError for a
 *  file that is not a backup; decrypt errors pass through for the caller. */
export async function openBackupFile(text: string, passphrase: string): Promise<OpenedBackup> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new NotABackupError('not json');
  }
  if (isV3(parsed)) {
    // Throws "wrong passphrase" from tapit-attest before anything else runs.
    const kData = unwrapKData(parsed.wallet, passphrase);
    const wallet = await Wallet.restoreFromKData(parsed.wallet, kData);
    const records = parseRecords(await openData(parsed.data, kData));
    return { wallet, kData, records, ownerId: parsed.owner_id, createdAt: parsed.created_at };
  }
  if (isV2(parsed)) {
    const wallet = await Wallet.restore(parsed.wallet, passphrase);
    const bytes = decrypt(parsed.data, passphrase);
    const records = parseRecords(new TextDecoder().decode(bytes));
    return { wallet, kData: null, records, ownerId: parsed.owner_id, createdAt: parsed.created_at };
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'v' in parsed) {
    const wallet = await Wallet.restore(parsed as Parameters<typeof Wallet.restore>[0], passphrase);
    return { wallet, kData: null, records: null, ownerId: null, createdAt: null };
  }
  throw new NotABackupError('unknown shape');
}

/** Replace every occurrence of the old owner id in keys and string values.
 *  Some records carry other records' keys (outbox and anchor indexes), so
 *  rewriting only the top-level key would leave them pointing at nothing. */
export function rehomeRecords(records: Array<[string, unknown]>, from: string, to: string): Array<[string, unknown]> {
  if (!from || from === to) return records;
  const swap = (s: string) => s.split(from).join(to);
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return swap(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object' && !(v instanceof Uint8Array) && !(v instanceof Date)) {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) out[swap(k)] = walk(x);
      return out;
    }
    return v;
  };
  return records.map(([k, v]) => [swap(k), walk(v)]);
}

/** Write restored records into this device's storage. A record that already
 *  exists here is left alone (never overwrite local data without asking). */
export async function writeRestoredRecords(records: Array<[string, unknown]>): Promise<{ written: number; kept: number }> {
  let written = 0;
  let kept = 0;
  for (const [k, v] of records) {
    if (k.startsWith(WALLET_KEY_PREFIX)) continue;
    if ((await idb.get(k)) !== undefined) {
      kept++;
      continue;
    }
    await idb.put(k, v);
    written++;
  }
  return { written, kept };
}
