import { describe, it, expect } from 'vitest';
import { Wallet, generateKeypair, createSuccessionLink } from 'tapit-attest';
import type { SuccessionLink } from 'tapit-attest';
import {
  buildKeySuccessionAnnouncement,
  isKeySuccessionAnnouncement,
  isVerifiedAnnouncement,
  readSuccessionChain,
  buildPeerKeyAlias,
  resolveCanonical,
  resolveCurrent,
} from './peerSuccession.ts';

// genesis(prev) -> current, signed announcement by the current key.
function rotatedAnnouncement() {
  const prev = generateKeypair();
  const current = generateKeypair();
  const chain: SuccessionLink[] = [
    createSuccessionLink({ fromPrivateKey: prev.privateKey, toKey: current.publicKey }),
  ];
  const signed = Wallet.fromKeypair(current).sign(
    buildKeySuccessionAnnouncement(chain),
  );
  return { prev, current, chain, signed };
}

describe('key-succession announcement', () => {
  it('builds, identifies, and round-trips the chain', () => {
    const { chain, signed } = rotatedAnnouncement();
    expect(isKeySuccessionAnnouncement(signed)).toBe(true);
    expect(readSuccessionChain(signed)?.length).toBe(chain.length);
  });

  it('is not mistaken for another credential', () => {
    const { signed } = rotatedAnnouncement();
    const claim = signed.claim as { children: { name: string; value: unknown }[] };
    const leaf = claim.children.find((c) => c.name === 'credential_type');
    if (leaf) leaf.value = 'membership';
    expect(isKeySuccessionAnnouncement(signed)).toBe(false);
  });
});

describe('isVerifiedAnnouncement', () => {
  it('accepts a chain-valid announcement signed by the current key', () => {
    const { signed } = rotatedAnnouncement();
    expect(isVerifiedAnnouncement(signed)).toBe(true);
  });
  it('rejects one not signed by the current key', () => {
    const prev = generateKeypair();
    const current = generateKeypair();
    const imposter = generateKeypair();
    const chain = [
      createSuccessionLink({ fromPrivateKey: prev.privateKey, toKey: current.publicKey }),
    ];
    const signed = Wallet.fromKeypair(imposter).sign(
      buildKeySuccessionAnnouncement(chain),
    );
    expect(isVerifiedAnnouncement(signed)).toBe(false);
  });
  it('rejects a non-announcement', () => {
    const { signed } = rotatedAnnouncement();
    const claim = signed.claim as { children: { name: string; value: unknown }[] };
    const leaf = claim.children.find((c) => c.name === 'credential_type');
    if (leaf) leaf.value = 'membership';
    expect(isVerifiedAnnouncement(signed)).toBe(false);
  });
});

describe('buildPeerKeyAlias / resolveCanonical / resolveCurrent', () => {
  it('maps an old key to its canonical genesis and forward to current', () => {
    const { prev, current, signed } = rotatedAnnouncement();
    const alias = buildPeerKeyAlias([signed]);
    // both the old and new key resolve to the genesis (canonical) key
    expect(resolveCanonical(current.publicKey, alias)).toBe(prev.publicKey);
    expect(resolveCanonical(prev.publicKey, alias)).toBe(prev.publicKey);
    // the send path walks forward to the current key
    expect(resolveCurrent(prev.publicKey, alias)).toBe(current.publicKey);
    expect(resolveCurrent(current.publicKey, alias)).toBe(current.publicKey);
  });

  it('walks a two-hop chain (prev -> mid -> current)', () => {
    const prev = generateKeypair();
    const mid = generateKeypair();
    const current = generateKeypair();
    const link0 = createSuccessionLink({
      fromPrivateKey: prev.privateKey,
      toKey: mid.publicKey,
    });
    const link1 = createSuccessionLink({
      fromPrivateKey: mid.privateKey,
      toKey: current.publicKey,
      previous: link0,
    });
    const signed = Wallet.fromKeypair(current).sign(
      buildKeySuccessionAnnouncement([link0, link1]),
    );
    const alias = buildPeerKeyAlias([signed]);
    expect(resolveCanonical(current.publicKey, alias)).toBe(prev.publicKey);
    expect(resolveCanonical(mid.publicKey, alias)).toBe(prev.publicKey);
    expect(resolveCurrent(prev.publicKey, alias)).toBe(current.publicKey);
  });

  it('rejects an announcement NOT signed by the chain current key', () => {
    const prev = generateKeypair();
    const current = generateKeypair();
    const imposter = generateKeypair();
    const chain = [
      createSuccessionLink({ fromPrivateKey: prev.privateKey, toKey: current.publicKey }),
    ];
    // signed by an unrelated key, not `current`
    const signed = Wallet.fromKeypair(imposter).sign(
      buildKeySuccessionAnnouncement(chain),
    );
    const alias = buildPeerKeyAlias([signed]);
    // not trusted → keys resolve to themselves
    expect(resolveCanonical(current.publicKey, alias)).toBe(
      current.publicKey.toLowerCase(),
    );
    expect(alias.canonicalOf.size).toBe(0);
  });

  it('an unknown key resolves to itself', () => {
    const alias = buildPeerKeyAlias([]);
    const k = generateKeypair().publicKey;
    expect(resolveCanonical(k, alias)).toBe(k.toLowerCase());
    expect(resolveCurrent(k, alias)).toBe(k.toLowerCase());
  });
});
