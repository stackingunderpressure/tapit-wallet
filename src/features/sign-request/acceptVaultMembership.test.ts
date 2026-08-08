import { describe, expect, it, vi } from 'vitest';

// Mock the idb wrapper so acceptVaultMembership's anchorQueue.upsert call
// doesn't need a real IndexedDB in the test environment (jsdom does not
// implement it) -- same pattern as prefsStore.test.ts / sharedNotesStore.test.ts.
const store = new Map<string, unknown>();
vi.mock('../../shared/lib/idb.ts', () => ({
  idb: {
    get: async <T>(key: string): Promise<T | undefined> => store.get(key) as T | undefined,
    put: async (key: string, value: unknown): Promise<void> => {
      store.set(key, value);
    },
    delete: async (key: string): Promise<void> => {
      store.delete(key);
    },
  },
}));

import { Wallet } from 'tapit-attest';
import { acceptVaultMembership } from './acceptVaultMembership.ts';
import { findVaultTrail, isKnownLeafScript, readVaultMembership } from './vaultTrail.ts';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import type { VaultMembershipRequestPayload } from './vaultMembershipChannel.ts';

const DESCRIPTOR = 'tr_multileaf(...)';
const LEAF_HEX = '51876321' + 'ab'.repeat(28);

function request(overrides: Partial<VaultMembershipRequestPayload> = {}): VaultMembershipRequestPayload {
  return {
    v: 1,
    vault_descriptor: DESCRIPTOR,
    vault_name: 'Family Trust',
    role: 'founder',
    leaf_scripts: [LEAF_HEX],
    ...overrides,
  };
}

describe('acceptVaultMembership', () => {
  it('mints a wallet-self-signed vault-membership attestation that satisfies findVaultTrail', async () => {
    const wallet = Wallet.generate();
    const saved: boolean[] = [];
    const signed = await acceptVaultMembership(
      wallet,
      'owner-1',
      request(),
      async () => {
        saved.push(true);
      },
      null,
    );

    expect(signed.kind).toBe('agreement');
    expect(signed.signatures.map((s) => s.signer)).toContain(wallet.identity);
    expect(saved).toEqual([true]);

    const holdings = await wallet.holdings();
    expect(holdings).toHaveLength(1);

    // The exact gate psbt-cosign's approve path checks (vaultTrail.ts) --
    // this is the whole point of Cut C3: prove the self-minted attestation
    // actually clears findVaultTrail's signedByMe requirement.
    const trail = findVaultTrail(holdings, DESCRIPTOR, wallet.publicKey);
    expect(trail).not.toBeNull();
    expect(isKnownLeafScript(trail!, LEAF_HEX)).toBe(true);
    expect(isKnownLeafScript(trail!, 'deadbeef')).toBe(false);

    const view = readVaultMembership(trail!);
    expect(view.role).toBe('founder');
    expect(view.vaultName).toBe('Family Trust');
    expect(view.highValueThresholdSats).toBeNull();
  });

  it('carries a declared high-value threshold through to the held attestation', async () => {
    const wallet = Wallet.generate();
    const signed = await acceptVaultMembership(
      wallet,
      'owner-1',
      request({ high_value_threshold_sats: '1000000' }),
      async () => {},
      null,
    );
    const view = readVaultMembership(signed);
    expect(view.highValueThresholdSats).toBe(1_000_000n);
  });

  it('queues the held attestation for anchoring', async () => {
    const wallet = Wallet.generate();
    await acceptVaultMembership(wallet, 'owner-1', request(), async () => {}, null);
    const rows = await anchorQueue.all('owner-1');
    expect(rows.some((r) => r.state === 'queued')).toBe(true);
  });

  it('tolerates a null worker (no kick attempted, no throw)', async () => {
    const wallet = Wallet.generate();
    await expect(
      acceptVaultMembership(wallet, 'owner-1', request(), async () => {}, null),
    ).resolves.toBeDefined();
  });
});
