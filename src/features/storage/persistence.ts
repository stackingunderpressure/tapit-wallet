// Ask the browser to keep this site's storage (IndexedDB holds the encrypted
// wallet). Browsers may refuse; the app reports the answer rather than
// assuming it (SOVEREIGN_SYNC_PLAN.md, section 5). Nothing here deletes data.

export type PersistenceState = 'granted' | 'not-granted' | 'unsupported';

interface StorageManagerLike {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
}

export async function requestPersistentStorage(
  manager: StorageManagerLike | undefined = typeof navigator !== 'undefined' ? navigator.storage : undefined,
): Promise<PersistenceState> {
  if (!manager?.persist) return 'unsupported';
  try {
    if (manager.persisted && (await manager.persisted())) return 'granted';
    return (await manager.persist()) ? 'granted' : 'not-granted';
  } catch {
    return 'unsupported';
  }
}
