import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encryptRecoverable,
  encryptRecoverableWithKData,
  decryptRecoverableWithPassphrase,
  decryptRecoverableWithKData,
  unwrapKData,
} from '../dist/index.js';

// v2 recoverable backup format — the cryptographic foundation for
// Phase 5e cascade recovery. K_data is freshly random per
// encryption and wrapped two independent ways: PBKDF2(passphrase)
// for normal unlock, plus returned to the caller so it can be
// Shamir-split across cohort peers. Either path lands on the same
// plaintext.

test('a string round-trips via the passphrase path', () => {
  const { blob } = encryptRecoverable('hello', 'correct horse');
  const bytes = decryptRecoverableWithPassphrase(blob, 'correct horse');
  assert.equal(new TextDecoder().decode(bytes), 'hello');
});

test('a string round-trips via the kData path (recovery)', () => {
  const { blob, kData } = encryptRecoverable('hello', 'correct horse');
  const bytes = decryptRecoverableWithKData(blob, kData);
  assert.equal(new TextDecoder().decode(bytes), 'hello');
});

test('passphrase and kData paths produce identical plaintext', () => {
  const { blob, kData } = encryptRecoverable('shared output', 'pw');
  const fromPassphrase = decryptRecoverableWithPassphrase(blob, 'pw');
  const fromKData = decryptRecoverableWithKData(blob, kData);
  assert.deepEqual(fromPassphrase, fromKData);
});

test('the wrong passphrase fails', () => {
  const { blob } = encryptRecoverable('secret', 'right');
  assert.throws(
    () => decryptRecoverableWithPassphrase(blob, 'wrong'),
    /wrong passphrase/,
  );
});

test('the wrong kData fails', () => {
  const { blob } = encryptRecoverable('secret', 'pw');
  const fakeKData = new Uint8Array(32);
  assert.throws(
    () => decryptRecoverableWithKData(blob, fakeKData),
    /wrong K_data/,
  );
});

test('kData length is enforced — wrong length rejected before AES attempt', () => {
  const { blob } = encryptRecoverable('secret', 'pw');
  assert.throws(
    () => decryptRecoverableWithKData(blob, new Uint8Array(16)),
    /32 bytes/,
  );
});

test('each encryption uses a fresh K_data, salt, and IVs', () => {
  const a = encryptRecoverable('same plaintext', 'same pw');
  const b = encryptRecoverable('same plaintext', 'same pw');
  assert.notDeepEqual(a.kData, b.kData);
  assert.notEqual(a.blob.salt, b.blob.salt);
  assert.notEqual(a.blob.wrapIv, b.blob.wrapIv);
  assert.notEqual(a.blob.dataIv, b.blob.dataIv);
  // Same plaintext + different K_data → different ciphertext.
  assert.notEqual(a.blob.dataCiphertext, b.blob.dataCiphertext);
});

test('an empty passphrase is rejected', () => {
  assert.throws(() => encryptRecoverable('secret', ''), /passphrase/);
});

test('raw bytes round-trip too', () => {
  const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const { blob, kData } = encryptRecoverable(data, 'pw');
  assert.deepEqual(decryptRecoverableWithKData(blob, kData), data);
  assert.deepEqual(decryptRecoverableWithPassphrase(blob, 'pw'), data);
});

test('decryptRecoverable* rejects an old v1 blob', () => {
  const fakeV1 = { v: 1, kdf: 'pbkdf2-sha256', iterations: 1, salt: '00', iv: '00', ciphertext: '00' };
  assert.throws(
    () => decryptRecoverableWithPassphrase(fakeV1, 'pw'),
    /unsupported recoverable-blob format/,
  );
});

test('the v2 blob carries enough self-description to round-trip via JSON', () => {
  const { blob, kData } = encryptRecoverable('through json', 'pw');
  const serialized = JSON.stringify(blob);
  const parsed = JSON.parse(serialized);
  assert.deepEqual(
    decryptRecoverableWithKData(parsed, kData),
    new TextEncoder().encode('through json'),
  );
});

// --- K_data preservation across saves (Phase 5e cohort cascade) ---
//
// Once the operator publishes a cohort, the cohort peers hold
// Shamir shares of THIS K_data. Subsequent saves must re-encrypt
// with the SAME K_data or the shares become useless. The unlock
// path extracts K_data; the save path uses encryptRecoverableWithKData
// to keep it stable across saves.

test('unwrapKData returns the same K_data exportRecoverable minted', () => {
  const { blob, kData } = encryptRecoverable('preserved across saves', 'pw');
  const unwrapped = unwrapKData(blob, 'pw');
  assert.deepEqual(unwrapped, kData);
});

test('unwrapKData fails on the wrong passphrase', () => {
  const { blob } = encryptRecoverable('secret', 'right');
  assert.throws(() => unwrapKData(blob, 'wrong'), /K_data unwrap failed/);
});

test('unwrapKData rejects a v1 blob explicitly', () => {
  const fakeV1 = { v: 1, kdf: 'pbkdf2-sha256', iterations: 1, salt: '00', iv: '00', ciphertext: '00' };
  assert.throws(() => unwrapKData(fakeV1, 'pw'), /unsupported recoverable-blob format/);
});

test('encryptRecoverableWithKData reuses the supplied K_data', () => {
  const original = encryptRecoverable('first save', 'pw');
  const newBlob = encryptRecoverableWithKData('second save', 'pw', original.kData);
  // The new blob is keyed on the same K_data — recovery via that
  // K_data on the new blob lands on the second-save plaintext.
  const bytes = decryptRecoverableWithKData(newBlob, original.kData);
  assert.equal(new TextDecoder().decode(bytes), 'second save');
  // And unwrapping the new blob with the same passphrase yields
  // the same K_data — the seam that lets cohort shares stay valid.
  assert.deepEqual(unwrapKData(newBlob, 'pw'), original.kData);
});

test('encryptRecoverableWithKData refreshes the salt and IVs every call', () => {
  const original = encryptRecoverable('save 0', 'pw');
  const a = encryptRecoverableWithKData('save A', 'pw', original.kData);
  const b = encryptRecoverableWithKData('save B', 'pw', original.kData);
  // Same K_data, but the wrap salt + both IVs are fresh — repeated
  // K_data wrap-key+IV reuse would weaken AES-GCM, so the salt
  // rotation here is load-bearing for the passphrase path.
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.wrapIv, b.wrapIv);
  assert.notEqual(a.dataIv, b.dataIv);
});

test('encryptRecoverableWithKData rejects wrong-length K_data', () => {
  assert.throws(
    () => encryptRecoverableWithKData('x', 'pw', new Uint8Array(16)),
    /32 bytes/,
  );
});

test('encryptRecoverableWithKData rejects an empty passphrase', () => {
  const kData = new Uint8Array(32);
  kData.fill(0x42);
  assert.throws(() => encryptRecoverableWithKData('x', '', kData), /passphrase/);
});

test('end-to-end save loop: unwrap → re-encrypt → unwrap yields the same K_data', () => {
  // Simulates one full cycle of the wallet's save flow under a
  // declared cohort: unlock extracts K_data from blob N; the next
  // save writes blob N+1 keyed on the same K_data; the next unlock
  // extracts it again, identical bytes.
  const { blob: blob0 } = encryptRecoverable('save 0 plaintext', 'pw');
  const kData = unwrapKData(blob0, 'pw');
  const blob1 = encryptRecoverableWithKData('save 1 plaintext', 'pw', kData);
  const kDataAgain = unwrapKData(blob1, 'pw');
  assert.deepEqual(kDataAgain, kData);
  // And the new blob decrypts to the new plaintext via the
  // preserved K_data (proof: cohort shares of kData still work).
  assert.equal(
    new TextDecoder().decode(decryptRecoverableWithKData(blob1, kData)),
    'save 1 plaintext',
  );
});
