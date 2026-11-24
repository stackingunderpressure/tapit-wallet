import { describe, expect, it, vi, beforeEach } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('../../shared/lib/idb.ts', () => ({
  idb: {
    get: async <T>(key: string): Promise<T | undefined> => store.get(key) as T | undefined,
    put: async (key: string, value: unknown): Promise<void> => { store.set(key, value); },
    delete: async (key: string): Promise<void> => { store.delete(key); },
  },
}));

import { Wallet } from 'tapit-attest';
import { offerKey, heldCoversRequest } from './membershipOffer.ts';
import { dismissKey, NAMESPACE } from './useVaultMembershipRequests.ts';
import { leaveVaultMembership } from './leaveVaultMembership.ts';
import { acceptVaultMembership } from './acceptVaultMembership.ts';
import { dismissedRequestsStore } from '../storage/dismissedRequestsStore.ts';
import { findVaultTrail, readVaultMembership } from './vaultTrail.ts';
import fixture from './fixtures/fresh-address-vault.json';

// Operator, 2026-11-24: "Tried resending but tapit never seen it. I deleted
// original vault. Tried again nothing came" -- a resend carrying the
// fresh-address keys was dropped as "already accepted" while the old
// membership was held, then as "left" for good.

const OWNER = 'op-2026-11-24';
const base = { v: 1 as const, vault_descriptor: fixture.vault_descriptor, vault_name: 'My Vault', role: 'everyday', leaf_scripts: fixture.leaf_scripts };

describe('membership offers', () => {
  beforeEach(() => store.clear());

  it('an offer without fresh-address keys keeps the old key, so every stored decline or leave still means what it did', () => {
    expect(offerKey('d', 'heir')).toBe(dismissKey('d', 'heir'));
    expect(offerKey('d', 'heir', [])).toBe(dismissKey('d', 'heir'));
  });

  it('an offer WITH keys is a different offer from the old one', () => {
    expect(offerKey(base.vault_descriptor, 'everyday', fixture.ranged_keys)).not.toBe(dismissKey(base.vault_descriptor, 'everyday'));
  });

  it('a held membership without keys does not cover a request with keys; one with them does', () => {
    expect(heldCoversRequest([], fixture.ranged_keys)).toBe(false);
    expect(heldCoversRequest(fixture.ranged_keys, fixture.ranged_keys)).toBe(true);
    expect(heldCoversRequest([], undefined)).toBe(true);
  });

  it("the operator's case: left the old membership, then a resend with keys is NOT suppressed; a replay of the old offer still is", async () => {
    const wallet = Wallet.fromKeypair({ privateKey: fixture.tapit_private_key, publicKey: fixture.tapit_public_key });
    const old = await acceptVaultMembership(wallet, OWNER, base, async () => {}, null);
    await leaveVaultMembership(wallet, OWNER, null, old);
    const dismissed = await dismissedRequestsStore.load(OWNER, NAMESPACE);
    expect(dismissed.has(offerKey(base.vault_descriptor, 'everyday'))).toBe(true);
    expect(dismissed.has(offerKey(base.vault_descriptor, 'everyday', fixture.ranged_keys))).toBe(false);
  });

  it('accepting the updated offer replaces the old membership, so signing finds the one with keys', async () => {
    const wallet = Wallet.fromKeypair({ privateKey: fixture.tapit_private_key, publicKey: fixture.tapit_public_key });
    await acceptVaultMembership(wallet, OWNER, base, async () => {}, null);
    await acceptVaultMembership(wallet, OWNER, { ...base, ranged_keys: fixture.ranged_keys }, async () => {}, null);
    const holdings = await wallet.holdings();
    expect(holdings.length).toBe(1);
    const trail = findVaultTrail(holdings, base.vault_descriptor, wallet.keyHistory)!;
    expect(readVaultMembership(trail).rangedKeys).toEqual(fixture.ranged_keys);
  });
});
