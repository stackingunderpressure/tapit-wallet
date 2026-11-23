import { idb } from '../../shared/lib/idb.ts';

// The sovereign build has no sign-in service, so the id every store keys its
// records by ("ownerId") comes from this device instead (SOVEREIGN_SYNC_PLAN.md
// section 3.2). It is a storage label only, never a secret and never a way in:
// the passphrase (or Face ID) is still what opens the wallet.
//
// First run on a device that already holds a wallet from the hosted build:
// adopt that wallet's existing id, so every message, attachment and setting
// stays exactly where it is. No record is rewritten. A fresh device gets a new
// random id; restoring a backup file moves its records onto that id
// (fullBackup.ts rehomeRecords).

const DEVICE_OWNER_KEY = 'device-owner:v1';
const WALLET_PREFIX = 'wallet:';

interface WalletRecord { updated_at?: string }

export async function resolveDeviceOwnerId(newId: () => string = () => crypto.randomUUID()): Promise<string> {
  const saved = await idb.get<string>(DEVICE_OWNER_KEY);
  if (typeof saved === 'string' && saved.length > 0) return saved;

  const wallets = (await idb.entries())
    .filter(([k]) => k.startsWith(WALLET_PREFIX))
    .map(([k, v]) => ({ id: k.slice(WALLET_PREFIX.length), at: (v as WalletRecord | undefined)?.updated_at ?? '' }))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  // More than one wallet on a device only happens after signing in with two
  // accounts; the most recently saved one is the one in use.
  const id = wallets[0]?.id ?? newId();
  await idb.put(DEVICE_OWNER_KEY, id);
  return id;
}
