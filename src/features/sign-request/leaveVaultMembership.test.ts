import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the idb wrapper with an in-memory map, same pattern
// dismissedRequestsStore.test.ts and vaultMembershipChannelStore both
// rely on, so no real IndexedDB is needed.
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

import { Wallet } from 'tapit-attest';
import { leaveVaultMembership } from './leaveVaultMembership.ts';
import { dismissedRequestsStore } from '../storage/dismissedRequestsStore.ts';
import { NAMESPACE, dismissKey } from './useVaultMembershipRequests.ts';

const DESCRIPTOR = 'tr_multileaf(...)';
const OWNER = 'op-2026-08-17';

function membershipAttestation(wallet: Wallet) {
  return wallet.attest({
    kind: 'agreement',
    tier: 'high_stakes',
    subject: DESCRIPTOR,
    fields: {
      agreement_type: 'vault-membership',
      vault_descriptor: DESCRIPTOR,
      vault_name: 'Family Trust',
      role: 'heir',
      leaf_scripts: JSON.stringify(['deadbeef']),
    },
  });
}

describe('leaveVaultMembership', () => {
  beforeEach(() => store.clear());

  it('unholds the membership attestation', async () => {
    const wallet = Wallet.generate();
    const att = membershipAttestation(wallet);
    await wallet.hold(att);
    expect((await wallet.holdings()).length).toBe(1);

    await leaveVaultMembership(wallet, OWNER, null, att);

    expect((await wallet.holdings()).length).toBe(0);
  });

  it('marks the vault+role as dismissed, so a replayed or re-sent invite for the same offer never resurfaces (2026-08-17, operator: "when you leave a vault it then still receive the Nostr message and it wants you to rejoin again")', async () => {
    const wallet = Wallet.generate();
    const att = membershipAttestation(wallet);
    await wallet.hold(att);

    const key = dismissKey(DESCRIPTOR, 'heir');
    let dismissed = await dismissedRequestsStore.load(OWNER, NAMESPACE);
    expect(dismissed.has(key)).toBe(false);

    await leaveVaultMembership(wallet, OWNER, null, att);

    dismissed = await dismissedRequestsStore.load(OWNER, NAMESPACE);
    expect(dismissed.has(key)).toBe(true);
  });

  it('does not throw when there is no transport (best-effort notify skipped) and no stored reply channel', async () => {
    const wallet = Wallet.generate();
    const att = membershipAttestation(wallet);
    await wallet.hold(att);
    await expect(leaveVaultMembership(wallet, OWNER, null, att)).resolves.toBeUndefined();
  });
});
