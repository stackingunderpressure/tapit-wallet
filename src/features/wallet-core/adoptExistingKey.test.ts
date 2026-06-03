import { describe, expect, test, vi, beforeEach } from 'vitest';
import {
  Wallet,
  generateKeypair,
  publicKeyFromPrivate,
  envelopeId,
} from 'tapit-attest';

// saveWallet pulls in walletStore -> localStore -> IndexedDB, which isn't
// available in the jsdom unit environment. We only care that
// adoptExistingKey performs the key-succession assembly correctly and
// hands a persistable wallet to saveWallet; stub the persistence seam.
const saveWallet = vi.fn(
  async (_wallet: Wallet, _pass: string, _owner: string) => ({
    localSyncedAt: new Date().toISOString(),
    remoteSyncedAt: null,
    remoteFailed: false,
  }),
);
vi.mock('./saveWallet.ts', () => ({
  saveWallet: (wallet: Wallet, pass: string, owner: string) =>
    saveWallet(wallet, pass, owner),
}));

import { adoptExistingKey } from './adoptExistingKey.ts';

// A second, independent keypair stands in for the operator's "old Nostr
// nsec" they want to adopt. Generated fresh per run so we never hardcode
// a private key into the repo.
function makeOldKey() {
  const kp = generateKeypair();
  return { priv: kp.privateKey, pub: kp.publicKey };
}

const OWNER = 'owner-1';
const PASS = 'correct horse battery';

describe('adoptExistingKey', () => {
  beforeEach(() => {
    saveWallet.mockClear();
  });

  test('makes the supplied key the active signing key', async () => {
    const wallet = Wallet.generate();
    const old = makeOldKey();

    const { wallet: rebuilt, adoptedPublicKey, retiredPublicKey } =
      await adoptExistingKey(wallet, PASS, OWNER, old.priv);

    expect(adoptedPublicKey).toBe(old.pub);
    expect(rebuilt.publicKey).toBe(old.pub);
    expect(retiredPublicKey).toBe(wallet.publicKey);
  });

  test('preserves the wallet identity (genesis pubkey unchanged)', async () => {
    const wallet = Wallet.generate();
    const genesis = wallet.identity;
    const old = makeOldKey();

    const { wallet: rebuilt } = await adoptExistingKey(
      wallet,
      PASS,
      OWNER,
      old.priv,
    );

    expect(rebuilt.identity).toBe(genesis);
    expect(rebuilt.identity).not.toBe(rebuilt.publicKey);
  });

  test('produces a succession chain that verifies', async () => {
    const wallet = Wallet.generate();
    const old = makeOldKey();

    const { wallet: rebuilt } = await adoptExistingKey(
      wallet,
      PASS,
      OWNER,
      old.priv,
    );

    expect(rebuilt.verifyKeyHistory()).toBe(true);
    expect(rebuilt.keyHistory).toContain(wallet.identity);
    expect(rebuilt.keyHistory).toContain(old.pub);
  });

  test('retains the retiring key so old messages stay decryptable', async () => {
    const wallet = Wallet.generate();
    const priorActive = wallet.publicKey;
    const old = makeOldKey();

    const { wallet: rebuilt } = await adoptExistingKey(
      wallet,
      PASS,
      OWNER,
      old.priv,
    );

    // The prior active key lives on in the key history (retired), not as
    // the active key.
    expect(rebuilt.keyHistory).toContain(priorActive);
    expect(rebuilt.publicKey).not.toBe(priorActive);
  });

  test('keeps existing holdings intact through the switch', async () => {
    const wallet = Wallet.generate();
    // Sign something under the current key before adopting.
    const att = wallet.attest({
      kind: 'journal',
      tier: 'routine',
      subject: wallet.identity,
      fields: { title: 'before the switch' },
    });
    await wallet.hold(att);
    const before = await wallet.holdings();
    expect(before.length).toBe(1);
    const beforeId = envelopeId(before[0]!);

    const old = makeOldKey();
    const { wallet: rebuilt } = await adoptExistingKey(
      wallet,
      PASS,
      OWNER,
      old.priv,
    );

    const after = await rebuilt.holdings();
    expect(after.length).toBe(1);
    expect(envelopeId(after[0]!)).toBe(beforeId);
  });

  test('persists through saveWallet (K_data-preserving path)', async () => {
    const wallet = Wallet.generate();
    const old = makeOldKey();

    await adoptExistingKey(wallet, PASS, OWNER, old.priv);

    expect(saveWallet).toHaveBeenCalledTimes(1);
    const call = saveWallet.mock.calls[0]!;
    expect(call[0].publicKey).toBe(old.pub);
    expect(call[1]).toBe(PASS);
    expect(call[2]).toBe(OWNER);
  });

  test('chains a second adoption on top of the first', async () => {
    const wallet = Wallet.generate();
    const first = makeOldKey();
    const second = makeOldKey();

    const { wallet: afterFirst } = await adoptExistingKey(
      wallet,
      PASS,
      OWNER,
      first.priv,
    );
    const { wallet: afterSecond } = await adoptExistingKey(
      afterFirst,
      PASS,
      OWNER,
      second.priv,
    );

    expect(afterSecond.publicKey).toBe(second.pub);
    expect(afterSecond.identity).toBe(wallet.identity);
    expect(afterSecond.verifyKeyHistory()).toBe(true);
    expect(afterSecond.keyHistory).toEqual(
      expect.arrayContaining([wallet.identity, first.pub, second.pub]),
    );
  });

  test('rejects adopting the key that is already active', async () => {
    const wallet = Wallet.generate();
    const activePriv = (await wallet.snapshot()).activeKeypair.privateKey;

    await expect(
      adoptExistingKey(wallet, PASS, OWNER, activePriv),
    ).rejects.toThrow(/already/i);
    expect(saveWallet).not.toHaveBeenCalled();
  });

  test('rejects re-adopting a key already in the succession history', async () => {
    const wallet = Wallet.generate();
    const genesisPriv = (await wallet.snapshot()).activeKeypair.privateKey;
    const genesisPub = publicKeyFromPrivate(genesisPriv);
    const old = makeOldKey();

    // Adopt old, then try to adopt the genesis key (now retired) again.
    const { wallet: afterFirst } = await adoptExistingKey(
      wallet,
      PASS,
      OWNER,
      old.priv,
    );
    expect(afterFirst.keyHistory).toContain(genesisPub);

    saveWallet.mockClear();
    await expect(
      adoptExistingKey(afterFirst, PASS, OWNER, genesisPriv),
    ).rejects.toThrow(/already.*key history|key history.*already|already/i);
    expect(saveWallet).not.toHaveBeenCalled();
  });

  test('rejects malformed private keys', async () => {
    const wallet = Wallet.generate();
    await expect(
      adoptExistingKey(wallet, PASS, OWNER, 'not-hex'),
    ).rejects.toThrow(/64-character hex/);
    await expect(adoptExistingKey(wallet, '', OWNER, makeOldKey().priv))
      .rejects.toThrow(/passphrase/);
  });
});
