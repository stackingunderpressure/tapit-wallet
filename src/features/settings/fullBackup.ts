import { Wallet, encrypt, decrypt, type EncryptedBlob } from 'tapit-attest';
import { idb } from '../../shared/lib/idb.ts';

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
// Both parts are sealed with the passphrase on this device. Some records are
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

export interface OpenedBackup {
  wallet: Wallet;
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

/** Build the complete backup file's text from what is on this device now. */
export async function buildBackupFile(wallet: Wallet, ownerId: string, passphrase: string): Promise<{ text: string; records: number }> {
  const all = await idb.entries();
  const records = all.filter(([k]) => !k.startsWith(WALLET_KEY_PREFIX));
  const file: BackupFileV2 = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    created_at: new Date().toISOString(),
    owner_id: ownerId,
    wallet: await wallet.exportEncrypted(passphrase),
    data: encrypt(serializeRecords(records), passphrase),
  };
  return { text: JSON.stringify(file), records: records.length };
}

function isV2(x: unknown): x is BackupFileV2 {
  const o = x as Partial<BackupFileV2> | null;
  return !!o && typeof o === 'object' && o.format === BACKUP_FORMAT && o.version === BACKUP_VERSION
    && !!o.wallet && !!o.data && typeof o.owner_id === 'string';
}

export class NotABackupError extends Error {}

/** Open a backup file in memory. Writes nothing. Throws NotABackupError for a
 *  file that is not a backup; decrypt errors pass through for the caller. */
export async function openBackupFile(text: string, passphrase: string): Promise<OpenedBackup> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new NotABackupError('not json');
  }
  if (isV2(parsed)) {
    const wallet = await Wallet.restore(parsed.wallet, passphrase);
    const bytes = decrypt(parsed.data, passphrase);
    const records = parseRecords(new TextDecoder().decode(bytes));
    return { wallet, records, ownerId: parsed.owner_id, createdAt: parsed.created_at };
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'v' in parsed) {
    const wallet = await Wallet.restore(parsed as Parameters<typeof Wallet.restore>[0], passphrase);
    return { wallet, records: null, ownerId: null, createdAt: null };
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
