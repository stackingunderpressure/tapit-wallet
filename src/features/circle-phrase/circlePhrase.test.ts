import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { EncryptedBlob } from 'tapit-attest';

// Mock the idb wrapper with an in-memory map, same pattern as
// dismissedInboxStore.test.ts, so no real IndexedDB is needed.
const store = new Map<string, unknown>();

vi.mock('../../shared/lib/idb.ts', () => ({
  idb: {
    get: async <T>(key: string): Promise<T | undefined> =>
      store.get(key) as T | undefined,
    put: async (key: string, value: unknown): Promise<void> => {
      store.set(key, value);
    },
    delete: async (key: string): Promise<void> => {
      store.delete(key);
    },
  },
}));

// Mock the Supabase-backed remote store with an in-memory map keyed by
// owner_id, same shape (an opaque ciphertext blob) as the real thing.
const remote = new Map<string, EncryptedBlob>();

vi.mock('./remoteCirclePhraseStore.ts', () => ({
  remoteCirclePhraseStore: {
    get: async (ownerId: string): Promise<EncryptedBlob | undefined> => remote.get(ownerId),
    put: async (ownerId: string, blob: EncryptedBlob): Promise<void> => {
      remote.set(ownerId, blob);
    },
  },
}));

import {
  storeCirclePhrasePair,
  hasCirclePhrasePair,
  diagnoseCirclePhrase,
  checkCirclePhrase,
  pushCirclePhraseBackup,
  restoreCirclePhraseBackup,
} from './circlePhrase.ts';

const DESCRIPTOR = 'tr(...)';
const NAME = 'Family Trust';

const OWNER = 'owner-2026';
const PASSPHRASE = 'correct horse battery staple';

describe('circlePhrase', () => {
  beforeEach(() => {
    store.clear();
    remote.clear();
  });

  it('stores a pair and finds it under the same descriptor', async () => {
    await storeCirclePhrasePair({
      vaultDescriptor: DESCRIPTOR,
      vaultName: NAME,
      normalPhrase: 'blue horizon',
      duressPhrase: 'red horizon',
    });
    expect(await hasCirclePhrasePair(DESCRIPTOR)).toBe(true);
    expect(await checkCirclePhrase(DESCRIPTOR, 'blue horizon')).toBe('normal');
    expect(await checkCirclePhrase(DESCRIPTOR, 'red horizon')).toBe('duress');
  });

  describe('diagnoseCirclePhrase', () => {
    it('reports configured when the exact descriptor matches', async () => {
      await storeCirclePhrasePair({
        vaultDescriptor: DESCRIPTOR,
        vaultName: NAME,
        normalPhrase: 'blue horizon',
        duressPhrase: 'red horizon',
      });
      expect(await diagnoseCirclePhrase(DESCRIPTOR, NAME)).toEqual({ status: 'configured' });
    });

    it('reports not_configured when nothing has ever been received', async () => {
      expect(await diagnoseCirclePhrase(DESCRIPTOR, NAME)).toEqual({ status: 'not_configured' });
    });

    it('reports stale when a pair exists for the same vault name under a different descriptor -- the recompile case (operator, 2026-08-13: "it shows it on one side set up, but it is not showing it on the top side")', async () => {
      const staleDescriptor = 'tr(old-version...)';
      await storeCirclePhrasePair({
        vaultDescriptor: staleDescriptor,
        vaultName: NAME,
        normalPhrase: 'blue horizon',
        duressPhrase: 'red horizon',
      });
      // Sanity check: hasCirclePhrasePair on the CURRENT descriptor really
      // does come back empty -- this is the exact silent-fail-open case.
      expect(await hasCirclePhrasePair(DESCRIPTOR)).toBe(false);
      expect(await diagnoseCirclePhrase(DESCRIPTOR, NAME)).toEqual({
        status: 'stale',
        staleVaultName: NAME,
      });
    });

    it('reports not_configured (not stale) when the held pairs are for a differently-named vault', async () => {
      await storeCirclePhrasePair({
        vaultDescriptor: 'tr(unrelated...)',
        vaultName: 'A Totally Different Vault',
        normalPhrase: 'blue horizon',
        duressPhrase: 'red horizon',
      });
      expect(await diagnoseCirclePhrase(DESCRIPTOR, NAME)).toEqual({ status: 'not_configured' });
    });
  });

  describe('cloud backup (2026-08-13, operator: "if you switch browsers or phones or whatever you did not lose anything")', () => {
    it('round-trips a pair through push and restore on a fresh device', async () => {
      await storeCirclePhrasePair({
        vaultDescriptor: DESCRIPTOR,
        vaultName: NAME,
        normalPhrase: 'blue horizon',
        duressPhrase: 'red horizon',
      });
      await pushCirclePhraseBackup(OWNER, PASSPHRASE);

      // Simulate a new device / cleared browser: local storage is empty,
      // only the remote (encrypted) backup exists.
      store.clear();
      expect(await hasCirclePhrasePair(DESCRIPTOR)).toBe(false);

      await restoreCirclePhraseBackup(OWNER, PASSPHRASE);
      expect(await hasCirclePhrasePair(DESCRIPTOR)).toBe(true);
      expect(await checkCirclePhrase(DESCRIPTOR, 'blue horizon')).toBe('normal');
    });

    it('never stores the phrase pair in the clear remotely', async () => {
      await storeCirclePhrasePair({
        vaultDescriptor: DESCRIPTOR,
        vaultName: NAME,
        normalPhrase: 'blue horizon',
        duressPhrase: 'red horizon',
      });
      await pushCirclePhraseBackup(OWNER, PASSPHRASE);

      const raw = JSON.stringify(remote.get(OWNER));
      expect(raw).not.toContain('blue horizon');
      expect(raw).not.toContain('red horizon');
      expect(raw).not.toContain(NAME.toLowerCase());
    });

    it('is a no-op when there is nothing to restore yet', async () => {
      await restoreCirclePhraseBackup(OWNER, PASSPHRASE);
      expect(await hasCirclePhrasePair(DESCRIPTOR)).toBe(false);
    });

    it('does not clobber a locally newer entry for a different vault with an older remote one', async () => {
      const otherDescriptor = 'tr(other-vault...)';
      // Push a backup containing only DESCRIPTOR's pair.
      await storeCirclePhrasePair({
        vaultDescriptor: DESCRIPTOR,
        vaultName: NAME,
        normalPhrase: 'blue horizon',
        duressPhrase: 'red horizon',
        now: new Date('2026-01-01'),
      });
      await pushCirclePhraseBackup(OWNER, PASSPHRASE);

      // Locally receive a SECOND, newer pair for a different vault --
      // never pushed to the remote backup.
      await storeCirclePhrasePair({
        vaultDescriptor: otherDescriptor,
        vaultName: 'Newer Vault',
        normalPhrase: 'green horizon',
        duressPhrase: 'yellow horizon',
        now: new Date('2026-06-01'),
      });

      await restoreCirclePhraseBackup(OWNER, PASSPHRASE);
      // The local-only, newer entry must survive the merge untouched.
      expect(await checkCirclePhrase(otherDescriptor, 'green horizon')).toBe('normal');
      expect(await checkCirclePhrase(DESCRIPTOR, 'blue horizon')).toBe('normal');
    });
  });
});
