import { describe, expect, it, vi, beforeEach } from 'vitest';

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

import {
  storeCirclePhrasePair,
  hasCirclePhrasePair,
  diagnoseCirclePhrase,
  checkCirclePhrase,
} from './circlePhrase.ts';

const DESCRIPTOR = 'tr(...)';
const NAME = 'Family Trust';

describe('circlePhrase', () => {
  beforeEach(() => store.clear());

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
});
