import test from 'node:test';
import assert from 'node:assert/strict';
import { schnorr } from '@noble/curves/secp256k1';
import {
  generateKeypair,
  buildProofOfLife,
  buildDuressFlag,
  verifyProofOfLife,
  verifyDuressFlag,
  proofOfLifeDigestFor,
  duressFlagDigestFor,
  livenessStateFor,
  groupTally,
  meetsGreenQuorum,
} from '../dist/index.js';

const T0 = Date.parse('2026-01-01T00:00:00.000Z');
const TTL = 3600; // one hour
const within = (ms) => T0 + ms;

function hex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// --- freshness: fresh / stale / none ---------------------------------------

test('a fresh proof-of-life alone yields green', () => {
  const subj = generateKeypair();
  const pol = buildProofOfLife({
    signerPrivateKey: subj.privateKey,
    issuedAt: new Date(T0).toISOString(),
  });
  assert.equal(pol.subject, subj.publicKey);
  assert.equal(verifyProofOfLife(pol), true);
  const state = livenessStateFor({
    subject: subj.publicKey,
    group: [],
    proofOfLife: pol,
    ttlSeconds: TTL,
    now: within(60 * 1000), // one minute later, well inside the hour
  });
  assert.equal(state, 'green');
});

test('a stale proof-of-life (now past ttl) yields no-report', () => {
  const subj = generateKeypair();
  const pol = buildProofOfLife({
    signerPrivateKey: subj.privateKey,
    issuedAt: new Date(T0).toISOString(),
  });
  const state = livenessStateFor({
    subject: subj.publicKey,
    group: [],
    proofOfLife: pol,
    ttlSeconds: TTL,
    now: within(TTL * 1000 + 1), // one ms past the window
  });
  assert.equal(state, 'no-report');
});

test('no proof-of-life at all yields no-report', () => {
  const subj = generateKeypair();
  const state = livenessStateFor({
    subject: subj.publicKey,
    group: [],
    proofOfLife: null,
    ttlSeconds: TTL,
    now: within(0),
  });
  assert.equal(state, 'no-report');
});

// --- red dominance ----------------------------------------------------------

test('a red flag from a group member dominates a fresh proof-of-life', () => {
  const subj = generateKeypair();
  const peer = generateKeypair();
  const pol = buildProofOfLife({
    signerPrivateKey: subj.privateKey,
    issuedAt: new Date(T0).toISOString(),
  });
  const flag = buildDuressFlag({
    subject: subj.publicKey,
    signerPrivateKey: peer.privateKey,
    issuedAt: new Date(T0).toISOString(),
  });
  const state = livenessStateFor({
    subject: subj.publicKey,
    group: [peer.publicKey],
    proofOfLife: pol, // fresh and valid -- but red wins
    redFlags: [flag],
    ttlSeconds: TTL,
    now: within(60 * 1000),
  });
  assert.equal(state, 'red');
});

// --- no-rogue group filter --------------------------------------------------

test('a red flag from a non-member is ignored (stays green)', () => {
  const subj = generateKeypair();
  const rogue = generateKeypair();
  const member = generateKeypair();
  const pol = buildProofOfLife({
    signerPrivateKey: subj.privateKey,
    issuedAt: new Date(T0).toISOString(),
  });
  const flag = buildDuressFlag({
    subject: subj.publicKey,
    signerPrivateKey: rogue.privateKey, // not in group
    issuedAt: new Date(T0).toISOString(),
  });
  assert.equal(verifyDuressFlag(flag), true); // the flag itself is valid
  const state = livenessStateFor({
    subject: subj.publicKey,
    group: [member.publicKey], // rogue is NOT here
    proofOfLife: pol,
    redFlags: [flag],
    ttlSeconds: TTL,
    now: within(60 * 1000),
  });
  assert.equal(state, 'green'); // rogue cannot flip the subject red
});

test('a non-member red flag is ignored even with no proof-of-life (no-report)', () => {
  const subj = generateKeypair();
  const rogue = generateKeypair();
  const flag = buildDuressFlag({
    subject: subj.publicKey,
    signerPrivateKey: rogue.privateKey,
    issuedAt: new Date(T0).toISOString(),
  });
  const state = livenessStateFor({
    subject: subj.publicKey,
    group: [],
    proofOfLife: null,
    redFlags: [flag],
    ttlSeconds: TTL,
    now: within(0),
  });
  assert.equal(state, 'no-report');
});

// --- self-duress ------------------------------------------------------------

test('self-duress (raisedBy === subject) yields red even when subject not listed in group', () => {
  const subj = generateKeypair();
  const flag = buildDuressFlag({
    subject: subj.publicKey,
    signerPrivateKey: subj.privateKey, // subject flags themselves
    issuedAt: new Date(T0).toISOString(),
  });
  assert.equal(flag.raisedBy, subj.publicKey);
  const state = livenessStateFor({
    subject: subj.publicKey,
    group: [], // subject not even listed -- self is always allowed
    proofOfLife: buildProofOfLife({
      signerPrivateKey: subj.privateKey,
      issuedAt: new Date(T0).toISOString(),
    }),
    redFlags: [flag],
    ttlSeconds: TTL,
    now: within(60 * 1000),
  });
  assert.equal(state, 'red');
});

// --- tampered signatures: treated as absent / ignored -----------------------

test('a tampered proof-of-life signature does not count (no-report)', () => {
  const subj = generateKeypair();
  const pol = buildProofOfLife({
    signerPrivateKey: subj.privateKey,
    issuedAt: new Date(T0).toISOString(),
  });
  // Flip one hex char in the signature.
  const bad = pol.signature[0] === 'a' ? 'b' : 'a';
  pol.signature = bad + pol.signature.slice(1);
  assert.equal(verifyProofOfLife(pol), false);
  const state = livenessStateFor({
    subject: subj.publicKey,
    group: [],
    proofOfLife: pol,
    ttlSeconds: TTL,
    now: within(60 * 1000),
  });
  assert.equal(state, 'no-report'); // a bad heartbeat is treated as absent
});

test('a tampered duress signature does not count (red ignored)', () => {
  const subj = generateKeypair();
  const peer = generateKeypair();
  const flag = buildDuressFlag({
    subject: subj.publicKey,
    signerPrivateKey: peer.privateKey,
    issuedAt: new Date(T0).toISOString(),
  });
  const bad = flag.signature[0] === 'a' ? 'b' : 'a';
  flag.signature = bad + flag.signature.slice(1);
  assert.equal(verifyDuressFlag(flag), false);
  const state = livenessStateFor({
    subject: subj.publicKey,
    group: [peer.publicKey], // raiser IS a member, but sig is broken
    proofOfLife: null,
    redFlags: [flag],
    ttlSeconds: TTL,
    now: within(0),
  });
  assert.equal(state, 'no-report'); // a forged red cannot flip the subject
});

// --- quorum gate ------------------------------------------------------------

test('meetsGreenQuorum: 3 green of 5, m=3, zero reds -> true', () => {
  const states = ['green', 'green', 'green', 'no-report', 'no-report'];
  assert.equal(meetsGreenQuorum(states, 3), true);
});

test('meetsGreenQuorum: 3 green with one red present, m=3 -> false (any red blocks)', () => {
  const states = ['green', 'green', 'green', 'red', 'no-report'];
  assert.equal(meetsGreenQuorum(states, 3), false);
});

test('meetsGreenQuorum: 2 green, m=3 -> false (headcount short)', () => {
  const states = ['green', 'green', 'no-report', 'no-report', 'no-report'];
  assert.equal(meetsGreenQuorum(states, 3), false);
});

// --- groupTally -------------------------------------------------------------

test('groupTally counts green / no-report / red across subjects', () => {
  const a = generateKeypair();
  const b = generateKeypair();
  const c = generateKeypair();
  const peer = generateKeypair();
  const issuedAt = new Date(T0).toISOString();
  const proofs = {
    [a.publicKey]: buildProofOfLife({ signerPrivateKey: a.privateKey, issuedAt }),
    [b.publicKey]: buildProofOfLife({ signerPrivateKey: b.privateKey, issuedAt }),
    // c has no proof -> no-report
  };
  const redOnB = buildDuressFlag({
    subject: b.publicKey,
    signerPrivateKey: peer.privateKey,
    issuedAt,
  });
  const tally = groupTally([a.publicKey, b.publicKey, c.publicKey], {
    group: [peer.publicKey],
    proofs,
    redFlags: [redOnB],
    ttlSeconds: TTL,
    now: within(60 * 1000),
  });
  // a green, b red (peer is a group member), c no-report
  assert.deepEqual(tally, { green: 1, noReport: 1, red: 1 });
});

// --- digest-helper round-trip via a fake wallet boundary --------------------

test('proofOfLifeDigestFor matches the internal digest (fake wallet signDigest)', () => {
  const subj = generateKeypair();
  const issuedAt = new Date(T0).toISOString();
  const base = { v: 1, kind: 'proof-of-life', subject: subj.publicKey, issuedAt };
  // A wallet would expose signDigest(digest) -> hex; here we emulate it with
  // the raw key, proving the exposed digest matches what verify expects.
  const digest = proofOfLifeDigestFor(base);
  const signature = hex(schnorr.sign(digest, subj.privateKey));
  const att = { ...base, signature };
  assert.equal(verifyProofOfLife(att), true);
  const state = livenessStateFor({
    subject: subj.publicKey,
    group: [],
    proofOfLife: att,
    ttlSeconds: TTL,
    now: within(60 * 1000),
  });
  assert.equal(state, 'green');
});

test('duressFlagDigestFor matches the internal digest (fake wallet signDigest)', () => {
  const subj = generateKeypair();
  const peer = generateKeypair();
  const issuedAt = new Date(T0).toISOString();
  const base = {
    v: 1,
    kind: 'duress-flag',
    subject: subj.publicKey,
    raisedBy: peer.publicKey,
    issuedAt,
  };
  const digest = duressFlagDigestFor(base);
  const signature = hex(schnorr.sign(digest, peer.privateKey));
  const att = { ...base, signature };
  assert.equal(verifyDuressFlag(att), true);
  const state = livenessStateFor({
    subject: subj.publicKey,
    group: [peer.publicKey],
    proofOfLife: null,
    redFlags: [att],
    ttlSeconds: TTL,
    now: within(0),
  });
  assert.equal(state, 'red');
});

// --- builder input validation ----------------------------------------------

test('builders reject malformed input', () => {
  assert.throws(() => buildProofOfLife({ signerPrivateKey: 'nothex' }), /signerPrivateKey/);
  assert.throws(
    () => buildDuressFlag({ subject: 'short', signerPrivateKey: 'a'.repeat(64) }),
    /subject/,
  );
  const subj = generateKeypair();
  assert.throws(
    () => buildProofOfLife({ subject: 'a'.repeat(64), signerPrivateKey: subj.privateKey }),
    /subject does not match/,
  );
});
