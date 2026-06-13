import { describe, it, expect } from 'vitest';
import { PEER_COPY } from './peerCopy.ts';

// The peer-exchange copy is the friendly face of the cryptography. These tests
// guard the "warm & plain" voice: every label and hint is present, short, and
// carries NO cryptography jargon — the same guard secretTemplates uses to keep
// "Shamir/threshold" off the secrets screen.

// Crypto-specific terms that must never reach a peer-facing label or hint.
// Note "vouch", "connect", "approve", "group", "family", "backup" are plain
// English and deliberately allowed.
const JARGON =
  /shamir|threshold|attestation|envelope|pubkey|co-?sign|signature|anchor|mycelium|nip-?\d|ratif|counter-sign|merkle|cryptograph/i;

describe('peer-exchange copy', () => {
  const entries = Object.entries(PEER_COPY);

  it('every entry has a non-empty label and hint', () => {
    for (const [key, c] of entries) {
      expect(c.label.length, `${key}.label`).toBeGreaterThan(0);
      expect(c.hint.length, `${key}.hint`).toBeGreaterThan(0);
    }
  });

  it('keeps cryptography jargon off every label and hint', () => {
    for (const [key, c] of entries) {
      expect(`${c.label} ${c.hint}`, `${key} contains jargon`).not.toMatch(JARGON);
    }
  });

  it('keeps button labels short enough to tap (<= 14 chars)', () => {
    for (const [key, c] of entries) {
      expect(c.label.length, `${key}.label too long`).toBeLessThanOrEqual(14);
    }
  });
});
