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
import { toHex } from '@dynastytrust/bip341-psbt-signer';
import {
  noticeDigest, makeNotice, noticeVerifies, acceptCircleNotice, duressBlocks, markHeld, heldVaults, tellCircle, VAULT_DURESS_KIND,
} from './vaultDuress.ts';
import type { Transport } from '../transport/transport.ts';

// A wellness checker's duress phrase stops the whole circle (DynastyTrust
// docs/wellness-group-build-note.md, slice 2).

const DESCRIPTOR = 'tr(abc,{multi_a(1,x)})';
function member(w: Wallet, circle: string[]) {
  return w.attest({
    kind: 'agreement', tier: 'high_stakes', subject: DESCRIPTOR,
    fields: {
      agreement_type: 'vault-membership', vault_descriptor: DESCRIPTOR, vault_name: 'My Vault', role: 'wellness',
      leaf_scripts: JSON.stringify(['20' + w.publicKey + 'ac']), wellness_path: 'true', circle_keys: JSON.stringify(circle),
    },
  });
}
const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('vault duress', () => {
  beforeEach(() => store.clear());

  it('signs the exact bytes DynastyTrust checks (same fixed value as scripts/test-vault-duress.mjs)', () => {
    expect(toHex(noticeDigest('raise', DESCRIPTOR, '2026-11-25T12:00:00.000Z'))).toBe('28ee8aa77e89b45a5c3f6781bea52c5833e3ab821aaefe3171ca42f90e136b86');
  });

  it('a notice is signed by the key this wallet accepted the membership with', () => {
    const w = Wallet.generate();
    const trail = member(w, []);
    const n = makeNotice(w, trail, 'raise');
    expect(n.pubkey).toBe(w.publicKey.toLowerCase());
    expect(noticeVerifies(n)).toBe(true);
    expect(noticeVerifies({ ...n, kind: 'clear' })).toBe(false);
  });

  it('a notice is believed only from someone on the same wellness path', () => {
    const me = Wallet.generate(), friend = Wallet.generate(), stranger = Wallet.generate();
    const mine = member(me, [friend.publicKey.toLowerCase()]);
    const find = (d: string) => (d === DESCRIPTOR ? mine : null);
    expect(acceptCircleNotice(makeNotice(friend, member(friend, []), 'raise'), find)).toBe(mine);
    expect(acceptCircleNotice(makeNotice(stranger, member(stranger, []), 'raise'), find)).toBe(null);
  });

  it('refuses while DynastyTrust says held; a remembered hold refuses even when DynastyTrust is unreachable; a lifted one is forgotten', async () => {
    const held = () => json(200, { held: true, circle_hold: true, clears: 1, needed: 3, owner_cleared: false });
    expect(await duressBlocks('o', DESCRIPTOR, held as typeof fetch)).toMatch(/1 so far/);
    await markHeld('o', DESCRIPTOR, { vaultName: 'My Vault', at: 'now', by: 'k' });
    const down = () => Promise.reject(new Error('offline'));
    expect(await duressBlocks('o', DESCRIPTOR, down as typeof fetch)).toMatch(/duress phrase was used/);
    const lifted = () => json(200, { held: false, circle_hold: false, clears: 3, needed: 3, owner_cleared: true });
    expect(await duressBlocks('o', DESCRIPTOR, lifted as typeof fetch)).toBe(null);
    expect(await heldVaults('o')).toEqual({});
    expect(await duressBlocks('o', DESCRIPTOR, down as typeof fetch)).toBe(null);
  });

  it('tells every other person on the path, one encrypted event each, never itself', async () => {
    const me = Wallet.generate(), a = Wallet.generate(), b = Wallet.generate();
    const sent: { kind: number; tags: readonly (readonly string[])[] }[] = [];
    const transport = { publish: async (e: { kind: number; tags: readonly (readonly string[])[] }) => { sent.push(e); return { accepted: 1 }; } } as unknown as Transport;
    const n = makeNotice(me, member(me, []), 'raise');
    await tellCircle(transport, me, 'My Vault', n, [a.publicKey, b.publicKey, me.publicKey]);
    expect(sent.map((e) => e.kind)).toEqual([VAULT_DURESS_KIND, VAULT_DURESS_KIND]);
    expect(sent.map((e) => e.tags[0]![1]).sort()).toEqual([a.publicKey, b.publicKey].sort());
  });
});
