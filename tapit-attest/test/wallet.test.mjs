import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet, MemoryStore, verifyEnvelope, generateKeypair } from '../dist/index.js';

test('a generated wallet has matching identity and active key', () => {
  const w = Wallet.generate();
  assert.match(w.publicKey, /^[0-9a-f]{64}$/);
  assert.equal(w.identity, w.publicKey);
  assert.deepEqual(w.keyHistory, [w.publicKey]);
  assert.deepEqual(w.successionChain, []);
});

test('attest issues a signed, verifiable attestation', () => {
  const w = Wallet.generate();
  const a = w.attest({
    kind: 'identity',
    tier: 'routine',
    subject: 'did:example:ada',
    fields: { label: 'Ada' },
  });
  assert.equal(verifyEnvelope(a).valid, true);
  assert.equal(a.signatures[0].signer, w.publicKey);
});

test('two wallets can countersign one agreement', () => {
  const a = Wallet.generate();
  const b = Wallet.generate();
  const draft = a.attest({
    kind: 'agreement',
    tier: 'notable',
    subject: 'deal:handshake',
    fields: { terms: 'mutual' },
  });
  const cosigned = b.sign(draft);
  assert.equal(cosigned.signatures.length, 2);
  assert.equal(verifyEnvelope(cosigned).valid, true);
});

test('hold stores verified attestations and rejects tampered ones', async () => {
  const issuer = Wallet.generate();
  const holder = Wallet.generate();
  const a = issuer.attest({
    kind: 'credential',
    tier: 'routine',
    subject: holder.identity,
    fields: { award: 'gold' },
  });
  await holder.hold(a);
  assert.equal((await holder.holdings()).length, 1);
  assert.equal((await holder.aboutMe()).length, 1);

  const tampered = { ...a, subject: 'did:example:impostor' };
  await assert.rejects(() => holder.hold(tampered), /does not verify/);
});

test('aboutMe and issuedByMe partition the holdings correctly', async () => {
  const me = Wallet.generate();
  const peer = Wallet.generate();
  const aboutMe = peer.attest({
    kind: 'relationship',
    tier: 'routine',
    subject: me.identity,
    fields: { visits: 9 },
  });
  const byMe = me.attest({
    kind: 'relationship',
    tier: 'routine',
    subject: peer.identity,
    fields: { visits: 3 },
  });
  await me.hold(aboutMe);
  await me.hold(byMe);
  assert.equal((await me.aboutMe()).length, 1);
  assert.equal((await me.issuedByMe()).length, 1);
});

test('key rotation preserves identity and verifies as a chain', () => {
  const w = Wallet.generate();
  const genesis = w.identity;
  const firstKey = w.publicKey;
  w.rotate();
  assert.equal(w.identity, genesis);
  assert.notEqual(w.publicKey, firstKey);
  assert.equal(w.successionChain.length, 1);
  assert.equal(w.keyHistory.length, 2);
  assert.equal(w.verifyKeyHistory(), true);
  w.rotate();
  assert.equal(w.verifyKeyHistory(), true);
  assert.equal(w.identity, genesis);
});

test('a wallet round-trips through an encrypted backup', async () => {
  const w = Wallet.generate();
  const a = w.attest({
    kind: 'identity',
    tier: 'routine',
    subject: w.identity,
    fields: { label: 'Ada' },
  });
  await w.hold(a);
  w.rotate();

  const blob = await w.exportEncrypted('correct horse battery staple');
  const restored = await Wallet.restore(blob, 'correct horse battery staple');
  assert.equal(restored.identity, w.identity);
  assert.equal(restored.publicKey, w.publicKey);
  assert.equal(restored.verifyKeyHistory(), true);
  assert.equal((await restored.holdings()).length, 1);
  await assert.rejects(() => Wallet.restore(blob, 'wrong'), /decryption failed/);
});

test('a wallet round-trips through a v2 recoverable backup via passphrase', async () => {
  const w = Wallet.generate();
  const a = w.attest({
    kind: 'identity',
    tier: 'routine',
    subject: w.identity,
    fields: { label: 'Ada' },
  });
  await w.hold(a);
  w.rotate();

  const { blob, kData } = await w.exportRecoverable('correct horse battery staple');
  assert.equal(blob.v, 2);
  assert.equal(kData.length, 32);

  const restored = await Wallet.restoreFromRecoverable(
    blob,
    'correct horse battery staple',
  );
  assert.equal(restored.identity, w.identity);
  assert.equal(restored.publicKey, w.publicKey);
  assert.equal(restored.verifyKeyHistory(), true);
  assert.equal((await restored.holdings()).length, 1);
  await assert.rejects(
    () => Wallet.restoreFromRecoverable(blob, 'wrong'),
    /decryption failed/,
  );
});

test('a wallet restores from a v2 blob using a recovered K_data', async () => {
  // The Phase 5e recovery ceremony path: M cohort peers return their
  // Shamir shares, the new device combines them to recover K_data,
  // and the cloud blob decrypts WITHOUT the passphrase.
  const w = Wallet.generate();
  const a = w.attest({
    kind: 'credential',
    tier: 'notable',
    subject: w.identity,
    fields: { credential_type: 'identity', label: 'Ada' },
  });
  await w.hold(a);

  const { blob, kData } = await w.exportRecoverable('any passphrase');

  const restored = await Wallet.restoreFromKData(blob, kData);
  assert.equal(restored.identity, w.identity);
  assert.equal(restored.publicKey, w.publicKey);
  assert.equal((await restored.holdings()).length, 1);

  // Wrong-length K_data fails fast; wrong-bytes K_data fails on decrypt.
  await assert.rejects(
    () => Wallet.restoreFromKData(blob, new Uint8Array(16)),
    /K_data must be 32 bytes/,
  );
  const garbage = new Uint8Array(32);
  garbage.fill(0xab);
  await assert.rejects(
    () => Wallet.restoreFromKData(blob, garbage),
    /decryption failed/,
  );
});

test('v2 exportRecoverable mints a fresh K_data per call', async () => {
  const w = Wallet.generate();
  const a = await w.exportRecoverable('same passphrase');
  const b = await w.exportRecoverable('same passphrase');
  // Two back-to-back exports must NOT produce identical K_data —
  // the cascade's security rests on the randomness of each mint.
  assert.notDeepEqual(a.kData, b.kData);
  // Both still decrypt to a wallet with the same identity.
  const ra = await Wallet.restoreFromKData(a.blob, a.kData);
  const rb = await Wallet.restoreFromKData(b.blob, b.kData);
  assert.equal(ra.identity, w.identity);
  assert.equal(rb.identity, w.identity);
});

test('sync reconciles a wallet with a remote store both ways', async () => {
  const w = Wallet.generate();
  const a = w.attest({
    kind: 'credential',
    tier: 'routine',
    subject: 'did:example:ada',
    fields: { award: 'gold' },
  });
  await w.hold(a);
  const remote = new MemoryStore();
  const result = await w.sync(remote);
  assert.equal(result.pushed, 1);
  assert.equal((await remote.list()).length, 1);
});

test('a lost wallet rebuilds its holdings from a peer', async () => {
  const peer = Wallet.generate();
  const me = Wallet.generate();
  const myIdentity = me.identity;

  // The peer vouches for me and holds that attestation.
  const vouch = peer.attest({
    kind: 'relationship',
    tier: 'routine',
    subject: myIdentity,
    fields: { visits: 12 },
  });
  await peer.hold(vouch);

  // I lose my device. I ask the peer for my history, then rebuild onto a
  // fresh keypair under the same identity.
  const request = me.recoveryRequest();
  const response = await peer.answerRecovery(request);
  const newKeys = generateKeypair();
  const rebuilt = await Wallet.recoverHoldings(newKeys, myIdentity, [response]);
  assert.equal((await rebuilt.aboutMe()).length, 1);
});
